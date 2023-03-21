import { AnyMessageContent, WASocket, WAMessage, GroupMetadata } from '@adiwajshing/baileys'
import { Outgoing } from './outgoing'
import { Store, getStore, stores } from './store'
import { connect, Connection } from './socket'
import { Client, getClient, ConnectionInProgress, ClientConfig, defaultClientConfig } from './client'
import { toBaileysMessageContent, phoneNumberToJid, isIndividualJid, getMessageType, TYPE_MESSAGES_TO_PROCESS_FILE } from './transformer'
import { v1 as uuid } from 'uuid'
import { Response } from './response'
import { dataStores } from './data_store'

const clients: Map<string, Client> = new Map()
const connecting: Map<string, boolean> = new Map()

export const getClientBaileys: getClient = async (phone: string, outgoing: Outgoing, getStore: getStore, config: ClientConfig): Promise<Client> => {
  if (!clients.has(phone)) {
    if (connecting.has(phone)) {
      throw new ConnectionInProgress(`Connection with number ${phone} already in progress, please wait!`)
    } else {
      connecting.set(phone, true)
      console.info('Creating client baileys %s', phone)
      const store: Store = await getStore(phone)
      const client = new ClientBaileys(phone, store, outgoing, config)
      await client.connect()
      console.info('Client baileys created and connected %s', phone)
      clients.set(phone, client)
      connecting.delete(phone)
    }
  } else {
    console.debug('Retrieving client baileys %s', phone)
  }
  return clients.get(phone) as Client
}

interface GetGroupMetadata {
  (message: WAMessage, store: Store, sock: WASocket): Promise<GroupMetadata | undefined>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ignoreGetGroupMetadata: GetGroupMetadata = async (_message: WAMessage, _store: Store, _sock: WASocket) => undefined

const getGroupMetadata: GetGroupMetadata = async (message: WAMessage, store: Store, sock: WASocket) => {
  const { key } = message
  if (key.remoteJid && !isIndividualJid(key.remoteJid)) {
    return store?.dataStore.fetchGroupMetadata(key.remoteJid, sock)
  }
  return undefined
}

export class ClientBaileys implements Client {
  public phone: string
  public config: ClientConfig
  private sock: WASocket | undefined
  private outgoing: Outgoing
  private store: Store | undefined
  private getGroupMetadata: GetGroupMetadata

  constructor(phone: string, store: Store, outgoing: Outgoing, config: ClientConfig = defaultClientConfig) {
    this.phone = phone
    this.store = store
    this.outgoing = outgoing
    this.config = config

    this.getGroupMetadata = config.ignoreGroupMessages ? ignoreGetGroupMetadata : getGroupMetadata
  }

  async connect() {
    console.info('Client connecting...')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const connection: Connection<WASocket> = await connect({ store: this.store!, client: this })
    console.info('Client connected!')
    this.sock = connection?.sock
  }

  async disconnect() {
    this.sock = undefined
    this.store = undefined
    // clean cache
    clients.delete(this.phone)
    stores.delete(this.phone)
    connecting.delete(this.phone)
    dataStores.delete(this.phone)
  }

  async sendStatus(text: string) {
    const payload = {
      key: {
        remoteJid: phoneNumberToJid(this.phone),
        id: uuid(),
      },
      message: {
        conversation: text,
      },
      messageTimestamp: new Date().getTime(),
    }
    return this.outgoing.sendOne(this.phone, payload)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async send(payload: any) {
    const { status, type, to } = payload
    if (!this.sock) {
      const code = 3
      const title = 'Please, read the QRCode!'
      await this.sendStatus(title)
      this.connect()
      const id = uuid()
      const ok = {
        messaging_product: 'whatsapp',
        contacts: [
          {
            wa_id: to.replace('+', ''),
          },
        ],
        messages: [
          {
            id,
          },
        ],
      }
      const error = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: this.phone,
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: this.phone,
                    phone_number_id: this.phone,
                  },
                  statuses: [
                    {
                      id,
                      recipient_id: to,
                      status: 'failed',
                      timestamp: Math.floor(Date.now() / 1000),
                      errors: [
                        {
                          code,
                          title,
                        },
                      ],
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      }
      const r: Response = { ok, error, to }
      return r
    }
    if (status) {
      if (['sent', 'delivered', 'failed', 'progress', 'read'].includes(status)) {
        if (status == 'read') {
          const key = this.store?.dataStore?.loadKey(payload?.message_id)
          console.debug('key %s for %s', key, payload?.message_id)
          if (key) {
            await this.sock?.readMessages([key])
          }
        }
        const r: Response = { ok: { success: true }, to }
        return r
      } else {
        throw new Error(`Unknow message status ${status}`)
      }
    } else if (type) {
      if (['text', 'image', 'audio', 'document', 'video', 'template'].includes(type)) {
        const jid: string = await this.toJid(to)
        if (!jid) {
          const id = uuid()
          const ok = {
            messaging_product: 'whatsapp',
            contacts: [
              {
                wa_id: to.replace('+', ''),
              },
            ],
            messages: [
              {
                id,
              },
            ],
          }
          const error = {
            object: 'whatsapp_business_account',
            entry: [
              {
                id: this.phone,
                changes: [
                  {
                    value: {
                      messaging_product: 'whatsapp',
                      metadata: {
                        display_phone_number: this.phone,
                        phone_number_id: this.phone,
                      },
                      statuses: [
                        {
                          id,
                          recipient_id: to,
                          status: 'failed',
                          timestamp: Math.floor(Date.now() / 1000),
                          errors: [
                            {
                              code: 2,
                              title: `The number ${to} does not have Whatsapp Account`,
                            },
                          ],
                        },
                      ],
                    },
                    field: 'messages',
                  },
                ],
              },
            ],
          }
          const r: Response = { ok, error, to }
          return r
        }
        const content: AnyMessageContent = toBaileysMessageContent(payload)
        console.debug('Send to baileys', jid, content)
        const response = await this.sock?.sendMessage(jid, content)
        if (response) {
          const key = response.key
          const ok = {
            messaging_product: 'whatsapp',
            contacts: [
              {
                wa_id: to.replace('+', ''),
              },
            ],
            messages: [
              {
                id: key.id,
              },
            ],
          }
          const r: Response = { ok, to: to.replace('+', '') }
          return r
        }
      } else {
        throw new Error(`Unknow message type ${type}`)
      }
    }
    throw new Error(`Unknow message type ${JSON.stringify(payload)}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async receive(messages: any[], update = true) {
    console.debug(`Receives %s message(s)/update(s)`, messages.length)
    if (!update) {
      messages = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages.map(async (m: any) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          m.groupMetadata = await this.getGroupMetadata(m, this.store!, this.sock!)
          const messageType = getMessageType(m)
          if (messageType && TYPE_MESSAGES_TO_PROCESS_FILE.includes(messageType)) {
            const i: WAMessage = m as WAMessage
            await this.store?.dataStore.saveMedia(i)
          }
          return m
        }),
      )
    }
    return this.outgoing.sendMany(this.phone, messages)
  }

  private async toJid(phoneNumber: string) {
    const bindJid: string = phoneNumberToJid(phoneNumber)
    if (isIndividualJid(bindJid)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const jid = await this.store?.dataStore?.getJid(phoneNumber, this.sock!)
      if (jid) {
        console.debug(`${phoneNumber} exists on WhatsApp, as jid: ${jid}`)
        return jid
      } else {
        console.warn(`${phoneNumber} not exists on WhatsApp`)
        return ''
      }
    }
    return bindJid
  }
}
