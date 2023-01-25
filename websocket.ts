import { WebSocket } from "ws"

// code from typescript/lib/lib.dom.d.ts
// It is useful when using react-native with typescript.
// Or you can add dom libarary as `lib: ["esnext" ,"dom"]` in tsconfig.json

interface WebSocketEventMap {
    close: CloseEvent
    error: Event
    message: MessageEvent
    open: Event
}

interface CloseEvent extends Event {
    readonly code: number
    readonly reason: string
    readonly wasClean: boolean

    /** @deprecated */
    initCloseEvent(
        typeArg: string,
        canBubbleArg: boolean,
        cancelableArg: boolean,
        wasCleanArg: boolean,
        codeArg: number,
        reasonArg: string
    ): void
}

/** The MessageEvent interface represents a message received by a target object. */
interface MessageEvent extends Event {
    /**
     * Returns the data of the message.
     */
    readonly data: any
    /**
     * Returns the last event ID string, for
     * server-sent events.
     */
    readonly lastEventId: string
    /**
     * Returns the origin of the message, for server-sent events and
     * cross-document messaging.
     */
    readonly origin: string
    /**
     * Returns the MessagePort array sent with the message, for cross-document
     * messaging and channel messaging.
     */
    readonly ports: ReadonlyArray<MessagePort>
    /**
     * Returns the WindowProxy of the source window, for cross-document
     * messaging, and the MessagePort being attached, in the connect event fired at
     * SharedWorkerGlobalScope objects.
     */
    readonly source: MessageEventSource | null
}

type MessageEventSource = MessagePort

interface MessagePortEventMap {
    message: MessageEvent
    messageerror: MessageEvent
}

/** The MessagePort interface of the Channel Messaging API represents one of the two ports of a MessageChannel, allowing messages to be sent from one port and listening out for them arriving at the other. */
interface MessagePort extends EventTarget {
    onmessage: ((this: MessagePort, ev: MessageEvent) => any) | null
    onmessageerror: ((this: MessagePort, ev: MessageEvent) => any) | null

    /**
     * Disconnects the port, so that it is no longer active.
     */
    close(): void

    /**
     * Posts a message through the channel. Objects listed in transfer are
     * transferred, not just cloned, meaning that they are no longer usable on the sending side.
     * Throws a "DataCloneError" DOMException if
     * transfer contains duplicate objects or port, or if message
     * could not be cloned.
     */
    postMessage(message: any, transfer?: Transferable[]): void

    /**
     * Begins dispatching messages received on the port.
     */
    start(): void

    addEventListener<K extends keyof MessagePortEventMap>(
        type: K,
        listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): void

    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void

    removeEventListener<K extends keyof MessagePortEventMap>(
        type: K,
        listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any,
        options?: boolean | EventListenerOptions
    ): void

    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions
    ): void
}

declare type EventListenerOrEventListenerObject = EventListener | EventListenerObject

interface EventListener {
    (evt: Event): void
}

interface EventListenerObject {
    handleEvent(evt: Event): void
}

interface EventListenerOptions {
    capture?: boolean
}

interface AddEventListenerOptions extends EventListenerOptions {
    once?: boolean
    passive?: boolean
}

type Transferable = ArrayBuffer | MessagePort | ImageBitmap

interface ImageBitmap {
    /**
     * Returns the intrinsic height of the image, in CSS
     * pixels.
     */
    readonly height: number
    /**
     * Returns the intrinsic width of the image, in CSS
     * pixels.
     */
    readonly width: number

    /**
     * Releases imageBitmap's underlying bitmap data.
     */
    close(): void
}

export class WebSocketClient {
    url: string
    ws: WebSocket | null
    callback: (channelId: number) => void
    eventListeners: {
        type: keyof WebSocketEventMap
        listener: any
    }[] = []
    constructor(url: string, callback: (channelId: number) => void) {
        this.url = url
        this.callback = callback
    }
    addEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any
    ) {
        this.eventListeners.push({ type, listener })
        // @ts-ignore
        this.ws.addEventListener(type, listener)
    }
    removeAllEventListeners() {
        if (this.ws) {
            this.eventListeners.forEach(({ type, listener }) => {
                // @ts-ignore
                this.ws.removeEventListener(type, listener)
            })
            this.eventListeners = []
        }
    }
    connect() {
        this.removeAllEventListeners()
        this.ws = new WebSocket(this.url, {
            perMessageDeflate: false,
        })
        this.addEventListener("open", (event) => {
            console.log("open websocket")
        })
        this.addEventListener("close", (event) => {
            console.log("close websocket")
            setTimeout(() => {
                this.connect()
            }, 2000)
        })
        this.addEventListener("error", (event) => {
            console.log("error websocket", event)
            if (this.ws) {
                this.ws.close()
            }
        })
        this.addEventListener("message", async (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.channel_id) {
                    this.callback(data.channel_id)
                }
            } catch (error) {
                console.error("message error", error)
            }
        })
    }
}
