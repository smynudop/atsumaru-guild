;(function () {
    /*:
     * @plugindesc RPGアツマールAPIをローカル環境で擬似再現するプラグインです。
     * @author
     *
     *
     * @help
     * 特別な設定は必要ありません。
     */
    const Signal = {
        getGlobalSignals: async function (): Promise<any[]> {
            try {
                const signals = localStorage.getItem("atsumaruSimu_globalSignal")
                if (!signals) {
                    return []
                }
                return JSON.parse(signals) as any[]
            } catch (e) {
                return []
            }
        },
        sendSignalToGlobal: async function (data: string) {
            let signals: any[]
            try {
                let d = localStorage.getItem("atsumaruSimu_globalSignal")
                if (d) {
                    signals = JSON.parse(d)
                } else {
                    signals = []
                }
            } catch (e) {
                signals = []
            }

            signals.unshift({
                id: 1,
                senderId: 1,
                senderName: "",
                data: data,
                createdAt: Date.now(),
            })
            localStorage.setItem("atsumaruSimu_globalSignal", JSON.stringify(signals))
        },
    }

    const Storage = {
        setItems: async function (items: any[]) {},
        getSharedItems: async function (memberIds: number[]): Promise<any> {
            return {}
        },
    }

    const Interplayer = {
        enabled: async function () {},
    }
    const User = {
        getUserInformation: async function (userId: number): Promise<any> {
            return {
                id: userId,
                name: "damy" + userId,
                profile: "damy profile" + userId,
                twitterId: "damy" + userId,
                url: "damy url" + userId,
            }
        },
        getSelfInformation: async function (): Promise<any> {
            return {
                id: 1,
                name: "damy",
                profile: "damy profile",
                twitterId: "damy",
                url: "damy url",
                isPremium: true,
            }
        },
        getRecentUsers: async function (): Promise<any> {
            return {
                id: 1,
                name: "damy",
            }
        },
        getActiveUserCount: async function (minutes: number): Promise<number> {
            return 0
        },
    }
    if (!window.RPGAtsumaru) {
        const simulator = {
            signal: Signal,
            storage: Storage,
            interplayer: Interplayer,
            user: User,
        }
        // @ts-ignore
        window.RPGAtsumaru = simulator
    } else {
        console.log(window.RPGAtsumaru)
    }
})()
