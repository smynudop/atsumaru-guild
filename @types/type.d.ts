interface IParameter {
    guildflg: number
    userId: number
    guildId: number
    resultId: number
    errorMessage: number
    saveIndexStart: number
    saveIndexEnd: number
    loadIndexStart: number
    loadIndexEnd: number
}

interface ISharedData {
    guildflg: number
    data: (1 | 0)[]
}

type IJoinGuildSignal = {
    type: "guild-join"
    userId: number
    guildId: number
    userName: string
}

type IBuildGuildSignal = {
    type: "guild-build"
    userId: number
    guildId: number
    userName: string
    guildName: string
}

type ISignal = IJoinGuildSignal | IBuildGuildSignal

interface IGameInterpreter extends Function {
    bindPromiseForRPGAtsumaruPlugin: (
        promise: Promise<T>,
        resolve: (val: T) => void,
        reject: (err: any) => void
    ) => void
    _index: number
    _eventInfo: Recotd<string, any>
    _params: string[]
    _promiseResolverForRPGAtsumaruPlugin?: () => boolean
}

interface IGameVariables {
    value(index: number): unknown
    setValue(index: number, value: any): void
}

declare const $gameVariables: IGameVariables
declare const $gameActors: any
declare const Game_Interpreter: IGameInterpreter
declare const $dataSystem: any
declare const DataManager: any
declare const Graphics: any
declare const PluginManager: any
