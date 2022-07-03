;(function () {
    "use strict"
    // アツマールAPIから非同期処理を拝借
    function hook(baseClass: any, target: keyof typeof baseClass, f: (func: any) => any) {
        baseClass.prototype[target] = f(baseClass.prototype[target])
    }
    function hookStatic(baseClass: any, target: keyof typeof baseClass, f: any) {
        baseClass[target] = f(baseClass[target])
    }
    function isNumber(value: any) {
        return value !== "" && !isNaN(value)
    }
    function isInteger(value: any) {
        return typeof value === "number" && isFinite(value) && Math.floor(value) === value
    }
    function isNatural(value: any) {
        return isInteger(value) && value > 0
    }
    function isValidVariableId(variableId: any) {
        return isNatural(variableId) && variableId < $dataSystem.variables.length
    }
    //プラグインコマンドを追加する
    function addPluginCommand(commands: Record<string, Function>) {
        hook(Game_Interpreter, "pluginCommand", function (origin: Function) {
            return function (this: IGameInterpreter, command: string, args: any[]) {
                origin.apply(this, arguments)
                if (commands[command]) {
                    commands[command].apply(this, [command, ...args])
                }
            }
        })
    }
    // Promiseが終了するまでイベントコマンドをウェイトするための処理を追加する
    function prepareBindPromise() {
        if (!!Game_Interpreter.prototype.bindPromiseForRPGAtsumaruPlugin) {
            return
        }
        // Promiseを実行しつつ、それをツクールのインタプリタと結びつけて解決されるまで進行を止める
        Game_Interpreter.prototype.bindPromiseForRPGAtsumaruPlugin = function (
            this: IGameInterpreter,
            promise: Promise<any>,
            resolve: (val: any) => void,
            reject: (err: any) => void
        ) {
            var _this = this
            this._index--
            this._promiseResolverForRPGAtsumaruPlugin = function () {
                return false
            }
            promise.then(
                function (value) {
                    return (_this._promiseResolverForRPGAtsumaruPlugin = function () {
                        _this._index++
                        delete _this._promiseResolverForRPGAtsumaruPlugin
                        if (resolve) {
                            resolve(value)
                        }
                        return true
                    })
                },
                function (error: any) {
                    return (_this._promiseResolverForRPGAtsumaruPlugin = function () {
                        for (var key in _this._eventInfo) {
                            error[key] = _this._eventInfo[key]
                        }
                        error.line = _this._index + 1
                        error.eventCommand = "plugin_command"
                        error.content = _this._params[0]
                        switch (error.code) {
                            case "BAD_REQUEST":
                                throw error
                            case "UNAUTHORIZED":
                            case "FORBIDDEN":
                            case "INTERNAL_SERVER_ERROR":
                            case "API_CALL_LIMIT_EXCEEDED":
                            default:
                                console.error(error.code + ": " + error.message)
                                console.error(error.stack)
                                if (
                                    Graphics._showErrorDetail &&
                                    Graphics._formatEventInfo &&
                                    Graphics._formatEventCommandInfo
                                ) {
                                    var eventInfo = Graphics._formatEventInfo(error)
                                    var eventCommandInfo = Graphics._formatEventCommandInfo(error)
                                    console.error(
                                        eventCommandInfo
                                            ? eventInfo + ", " + eventCommandInfo
                                            : eventInfo
                                    )
                                }
                                _this._index++
                                delete _this._promiseResolverForRPGAtsumaruPlugin
                                if (reject) {
                                    reject(error)
                                }
                                return true
                        }
                    })
                }
            )
        }
        // 通信待機中はこのコマンドで足踏みし、通信に成功または失敗した時にPromiseの続きを解決する
        // このタイミングまで遅延することで、以下のようなメリットが生まれる
        // １．解決が次のコマンドの直前なので、他の並列処理に結果を上書きされない
        // ２．ゲームループ内でエラーが発生するので、エラー発生箇所とスタックトレースが自然に詳細化される
        // ３．ソフトリセット後、リセット前のexecuteCommandは叩かれなくなるので、
        //     リセット前のPromiseのresolverがリセット後のグローバルオブジェクトを荒らす事故がなくなる
        hook(Game_Interpreter, "executeCommand", function (origin) {
            return function (this: IGameInterpreter) {
                if (this._promiseResolverForRPGAtsumaruPlugin) {
                    var resolved = this._promiseResolverForRPGAtsumaruPlugin()
                    if (!resolved) {
                        return false
                    }
                }
                return origin.apply(this, arguments)
            }
        })
    }
    function toTypedParameters(parameters: Record<string, string>) {
        let result = {} as IParameter
        for (var key in parameters) {
            try {
                //@ts-ignore
                result[key] = JSON.parse(parameters[key])
            } catch (error) {
                //@ts-ignore
                result[key] = 0
            }
        }
        return result
    }
    function ensureValidVariableIds(parameters: IParameter) {
        hookStatic(DataManager, "isDatabaseLoaded", function (origin: any) {
            return function (this: any) {
                if (!origin.apply(this, arguments)) {
                    return false
                }
                for (var key in parameters) {
                    //@ts-ignore
                    var variableId = parameters[key]
                    if (variableId !== 0 && !isValidVariableId(variableId)) {
                        throw new Error(
                            "プラグインパラメータ「" +
                                key +
                                "」には、0～" +
                                ($dataSystem.variables.length - 1) +
                                "までの整数を指定してください。" +
                                key +
                                ": " +
                                variableId
                        )
                    }
                }
                return true
            }
        })
    }

    /*:
     * @plugindesc RPGアツマールでguildを実現するプラグインです。
     * @author
     *
     * @param guildflg
     * @type variable
     * @text ギルドフラグ
     * @desc ギルドの状態を保持する変数番号。0:未加入、1:ギルド主、2:ギルドメンバー
     * @default 0
     * 
     * @param userId
     * @type variable
     * @text ユーザーID
     * @desc ユーザーIDを保持する変数番号
     * @default 0
     *
     * @param guildId
     * @type variable
     * @text ギルドID
     * @desc ギルドIDを保持する変数番号
     * @default 0
     * 
     * @param resultId
     * @type variable
     * @text 実行結果
     * @desc 実行結果を格納する変数番号（正常終了:0、異常終了:1～9、エラー:10～）
     * @default 0
     * 
     * @param errorMessage
     * @type variable
     * @text エラーメッセージ
     * @desc エラーが発生した場合に、エラーメッセージを代入する変数の番号を指定します。
     * @default 0
     *
     * @param saveIndexStart
     * @type variable
     * @text 共有変数番号（開始）
     * @desc データを共有する変数番号
     * @default 0

     * @param saveIndexEnd
     * @type variable
     * @text 共有変数番号（終了）
     * @desc データを共有する変数番号
     * @default 0
     * 
     * @param loadIndexStart
     * @type variable
     * @text ロード変数番号（開始）
     * @desc 共有データをロードする変数番号
     * @default 0
     * 
     * @param loadIndexEnd
     * @type variable
     * @text ロード変数番号（開始）
     * @desc 共有データをロードする変数番号
     * @default 0
     * 
     * @help
     * guildMake: ギルドを作る。先にEnableInterplayerする必要がある
     * guildJoin: ギルドに入る。先にEnableInterplayerする必要がある
     * guildSave: データを保存する。
     * guildLoad: データを読み込む。
     * 
     * 返り値(resultIdの変数に入る数値)
     * 0: 正常終了
     * 1: ニコニコ未ログイン
     * 2: 既にギルド加入済み
     * 3: ギルドが存在しない
     * 9: RPGアツマール不存在
     * 10: その他エラー
     */

    const RESULT = {
        SUCCESS: 0,
        NOT_LOGIN: 1,
        ALREADY_JOIN_GULID: 2,
        NOT_EXIST_GUILD: 3,
        NOT_EXIST_RPG_ATSUMARU: 9,
        ERROR: 10,
    } as const

    const GUILD_FLG = {
        SOLO: 0,
        MASTER: 1,
        MEMBER: 2,
    } as const

    var parameters = toTypedParameters(PluginManager.parameters("Guild")) as IParameter
    prepareBindPromise()
    ensureValidVariableIds(parameters)

    function getGuildFlg(): number {
        return $gameVariables.value(parameters.guildflg) as number
    }

    function getUserId(): number {
        return $gameVariables.value(parameters.userId) as number
    }

    function getGuildId(): number {
        return $gameVariables.value(parameters.guildId) as number
    }

    function setGuildFlg(value: number) {
        $gameVariables.setValue(parameters.guildflg, value)
    }

    function setGuildName(value: string) {
        $gameActors.actor(2).setName(value)
    }

    function setUserId(value: number) {
        $gameVariables.setValue(parameters.userId, value)
    }

    function setGuildId(value: number) {
        $gameVariables.setValue(parameters.guildId, value)
    }

    async function getSignalList(): Promise<ISignal[]> {
        if (!window.RPGAtsumaru) return []

        var signals = await window.RPGAtsumaru.signal.getGlobalSignals()
        var datas = signals.map((s) => JSON.parse(s.data) as any[])

        let result: ISignal[] = []
        for (let data of datas) {
            if (data[0] == "guild-build") {
                result.push({
                    type: data[0],
                    userId: data[1],
                    guildId: data[2],
                    userName: data[3],
                    guildName: data[4],
                })
            } else {
                result.push({
                    type: data[0],
                    userId: data[1],
                    guildId: data[2],
                    userName: data[3],
                })
            }
        }
        return result
    }

    /**
     * globalSignalを送信する
     * @param data
     * @returns
     */
    async function sendSignal(data: ISignal) {
        if (!window.RPGAtsumaru) return false

        let sdata = ""
        switch (data.type) {
            case "guild-build":
                sdata = JSON.stringify([
                    data.type,
                    data.userId,
                    data.guildId,
                    data.userName,
                    data.guildName,
                ])
                break

            case "guild-join":
                sdata = JSON.stringify([data.type, data.userId, data.guildId, data.userName])
                break
        }

        await window.RPGAtsumaru.signal.sendSignalToGlobal(sdata)
        return true
    }

    /**
     *
     * @param guildId
     * @param userName
     * @param guildName
     * @returns
     */
    async function _MakeGuild(): Promise<number> {
        if (!window.RPGAtsumaru) {
            return RESULT.NOT_EXIST_RPG_ATSUMARU
        }
        var guildflg = getGuildFlg()
        if (guildflg != GUILD_FLG.SOLO) {
            return RESULT.ALREADY_JOIN_GULID
        }

        var userId = getUserId()
        var guildId = await _GenerateNewGuildId()

        var userName = $gameActors.actor(1).name()
        var guildName = $gameActors.actor(2).name()

        await sendSignal({
            type: "guild-build",
            userId: userId,
            guildId: guildId,
            userName: userName,
            guildName: guildName,
        })

        await sendSignal({
            type: "guild-join",
            guildId: guildId,
            userId: userId,
            userName: userName,
        })

        setGuildFlg(GUILD_FLG.MASTER)
        setGuildId(guildId)

        await _SaveGuild()

        return RESULT.SUCCESS
    }

    /**
     * ギルド
     * @param guildId
     * @param userName
     * @param guildName
     * @returns
     */
    async function _JoinGuild(): Promise<number> {
        if (!window.RPGAtsumaru) {
            return RESULT.NOT_EXIST_RPG_ATSUMARU
        }
        var guildflg = getGuildFlg()
        if (guildflg != GUILD_FLG.SOLO) {
            return RESULT.ALREADY_JOIN_GULID
        }

        var guildId = getGuildId()
        var userId = getUserId()

        var userName = $gameActors.actor(1).name()

        const guild = await _FetchGuildInfo(guildId)
        if (!guild) {
            return RESULT.NOT_EXIST_GUILD
        }

        setGuildName(guild.guildName)

        await sendSignal({
            type: "guild-join",
            userId: userId,
            guildId: guildId,
            userName: userName,
        })

        setGuildFlg(GUILD_FLG.MEMBER)
        setGuildId(guildId)

        return RESULT.SUCCESS
    }

    async function _GenerateNewGuildId(): Promise<number> {
        if (!window.RPGAtsumaru) {
            return 0
        }
        var signals = await getSignalList()
        var guildIds = signals
            .filter((args) => args.type == "guild-join")
            .map((args) => args.userId)

        var guildId: number = 0
        do {
            guildId = Math.floor(Math.random() * 900000) + 100000
        } while (guildIds.some((x) => x == guildId))

        return guildId
    }

    async function _FetchGuildInfo(guildId: number): Promise<IBuildGuildSignal | null> {
        var signals = await getSignalList()
        return (
            signals
                .filter((s): s is IBuildGuildSignal => s.type == "guild-build")
                .find((s) => s.guildId == guildId) ?? null
        )
    }

    /**
     * 共有セーブ処理
     * @returns
     */
    async function _SaveGuild(): Promise<number> {
        if (!window.RPGAtsumaru) {
            return RESULT.NOT_EXIST_RPG_ATSUMARU
        }

        var variables: (1 | 0)[] = []
        for (var i = parameters.saveIndexStart; i <= parameters.saveIndexEnd; i++) {
            variables.push($gameVariables.value(i) ? 1 : 0)
        }

        var value: ISharedData = {
            guildflg: getGuildFlg(),
            data: variables,
        }
        await window.RPGAtsumaru.storage.setItems([
            { key: "Atsumaru Shared", value: JSON.stringify(value) },
        ])

        return RESULT.SUCCESS
    }

    /**
     * ギルドメンバーのデータを読み込む
     * @returns
     */
    async function _LoadGuild(): Promise<number> {
        if (!window.RPGAtsumaru) {
            return RESULT.NOT_EXIST_RPG_ATSUMARU
        }

        var guildId = getGuildId()
        var signals = await getSignalList()

        var memberIds = signals
            .filter((args): args is IJoinGuildSignal => args.type == "guild-join")
            .filter((args) => args.guildId == guildId)
            .map((args) => args.userId)

        const shareItems = await window.RPGAtsumaru.storage.getSharedItems(memberIds)
        const datas = Object.keys(shareItems)
            .map((k) => shareItems[+k])
            .map((i) => JSON.parse(i) as ISharedData)
            .map((i) => i.data)

        var variables: number[] = []
        for (let i = 0; i < datas[0].length; i++) {
            variables.push(0)
        }

        for (let data of datas) {
            for (let i = 0; i < variables.length; i++) {
                variables[i] = variables[i] || data[i]
            }
        }

        for (var i = 0; i < variables.length; i++) {
            $gameVariables.setValue(i + parameters.loadIndexStart, variables[i])
        }

        return RESULT.SUCCESS
    }

    function MakeGuild(this: IGameInterpreter) {
        this.bindPromiseForRPGAtsumaruPlugin(
            _MakeGuild(),
            function (result: number) {
                $gameVariables.setValue(parameters.errorMessage, 0)
                $gameVariables.setValue(parameters.resultId, result)
            },
            function (err: Error) {
                $gameVariables.setValue(parameters.errorMessage, err.message)
                $gameVariables.setValue(parameters.resultId, RESULT.ERROR)
            }
        )
    }

    function JoinGuild(this: IGameInterpreter) {
        this.bindPromiseForRPGAtsumaruPlugin(
            _JoinGuild(),
            function (result: number) {
                $gameVariables.setValue(parameters.errorMessage, 0)
                $gameVariables.setValue(parameters.resultId, result)
            },
            function (err: Error) {
                $gameVariables.setValue(parameters.errorMessage, err.message)
                $gameVariables.setValue(parameters.resultId, RESULT.ERROR)
            }
        )
    }

    function SaveGuild(this: IGameInterpreter) {
        this.bindPromiseForRPGAtsumaruPlugin(
            _SaveGuild(),
            function (result: number) {
                $gameVariables.setValue(parameters.errorMessage, 0)
                $gameVariables.setValue(parameters.resultId, result)
            },
            function (err: Error) {
                $gameVariables.setValue(parameters.errorMessage, err.message)
                $gameVariables.setValue(parameters.resultId, RESULT.ERROR)
            }
        )
    }

    function LoadGuild(this: IGameInterpreter) {
        this.bindPromiseForRPGAtsumaruPlugin(
            _LoadGuild(),
            function (result: number) {
                $gameVariables.setValue(parameters.errorMessage, 0)
                $gameVariables.setValue(parameters.resultId, result)
            },
            function (err: Error) {
                $gameVariables.setValue(parameters.errorMessage, err.message)
                $gameVariables.setValue(parameters.resultId, RESULT.ERROR)
            }
        )
    }

    addPluginCommand({
        guildMake: MakeGuild,
        guildJoin: JoinGuild,
        guildLoad: LoadGuild,
        guildSave: SaveGuild,
    })
})()
