import { IncomingBaileys } from '../../src/services/incoming_baileys'
import { Incoming } from '../../src/services/incoming'
import { Outgoing } from '../../src/services/outgoing'
import { getClient, Client } from '../../src/services/client'

class DummyOutgoing implements Outgoing {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  async sendMany(_phone: string, _messages: []) { }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  async sendOne(_phone: string, _message: object) { }
}

class DummyClient implements Client {
  phone: string

  constructor() {
    this.phone = `${new Date().getTime()}`
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async connect(): Promise<void> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async disconnect(): Promise<void> {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  async sendStatus(text: string): Promise<void> {}
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  async send(payload: any): Promise<any> {
    return true
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  async receive(messages: object[], update: boolean): Promise<void> {}
}

const dummyClient = new DummyClient()

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getClientDummy: getClient = async (phone: string, outgoing: Outgoing): Promise<Client> => {
  return dummyClient
}

describe('service incoming baileys', () => {
  test('send', async () => {
    const phone = `${new Date().getTime()}`
    const service: Outgoing = new DummyOutgoing()
    const baileys: Incoming = new IncomingBaileys(service, getClientDummy)
    const payload: object = { humm: new Date().getTime() }
    const send = jest.spyOn(dummyClient, 'send')
    await baileys.send(phone, payload)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(payload)
  })
})
