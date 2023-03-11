import { Outgoing } from './outgoing'
import { getStore } from './store'

export interface getClient {
  (phone: string, outgoing: Outgoing, getStore: getStore, config: ClientConfig): Promise<Client>
}

export class ConnectionInProgress extends Error {
  constructor(message: string) {
    super(message)
  }
}

export type ClientConfig = {
  ignoreGroupMessages: boolean
  ignoreBroadcastStatus: boolean
}

export const defaultClientConfig: ClientConfig = {
  ignoreGroupMessages: true,
  ignoreBroadcastStatus: true,
}

export interface Client {
  phone: string
  config: ClientConfig

  connect(): Promise<void>

  disconnect(): Promise<void>

  sendStatus(text: string): Promise<void>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(payload: any): Promise<any>

  receive(messages: object[], update: boolean): Promise<void>
}
