import request from 'supertest'

import { App } from '../../src/app'
import { Incoming } from '../../src/services/incoming'
import { DataStore } from '../../src/services/data_store'
import { getDataStore } from '../../src/services/data_store'
import { proto } from '@adiwajshing/baileys'
import { mock } from 'jest-mock-extended'
import { getFilePath } from '../../src/services/data_store_file'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
const phone = `${new Date().getTime()}`
const remoteJid = `${new Date().getTime()}@s.whatsapp.net`
const messageId = `wa.${new Date().getTime()}`
const url = `http://somehost`
const messageKey = {
  id: messageId,
  remoteJid,
}
const text = `${new Date().getTime()}`
const mimetype = 'text/plain'
const extension = 'txt'
const link = `${text}.${extension}`
const audio: proto.Message.IAudioMessage = {
  // fileSha256,
  url: link,
  mimetype,
}
const m: proto.IMessage = {
  audioMessage: audio,
}
const message: proto.IWebMessageInfo = {
  key: messageKey,
  // caption: text,
  message: m,
}
const dataStore = mock<DataStore>()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getTestDataStore: getDataStore = (_phone: string, _config: unknown): DataStore => {
  return dataStore
}

describe('media routes', () => {
  test('index', async () => {
    dataStore.loadKey.mockReturnValue(messageKey)
    dataStore.loadMessage.mockReturnValue(new Promise((resolve) => resolve(message)))
    const service = mock<Incoming>()
    const app: App = new App(service, url, getTestDataStore)
    await request(app.server)
      .get(`/v15.0/${phone}/${messageId}`)
      .expect(200, {
        messaging_product: 'whatsapp',
        url: `${url}/v15.0/download/${phone}/${messageId}.${extension}`,
        file_name: `${phone}/${messageId}.${extension}`,
        mime_type: mimetype,
        id: `${phone}/${messageId}`,
      })
  })

  test('download', async () => {
    dataStore.loadKey.mockReturnValue(messageKey)
    dataStore.loadMessage.mockReturnValue(new Promise((resolve) => resolve(message)))
    const service = mock<Incoming>()
    const app: App = new App(service, url, getTestDataStore)
    const name = `${phone}/${messageId}.${extension}`
    const fileName = getFilePath(name)
    const parts = fileName.split('/')
    const dir: string = parts.splice(0, parts.length - 1).join('/')
    if (!existsSync(dir)) {
      mkdirSync(dir)
    }
    writeFileSync(fileName, `${new Date().getTime()}`)
    const endpoint = `/v15.0/download/${name}`
    const response = await request(app.server)
      .get(endpoint)
      .expect(200)
      .buffer()
      .parse((res: request.Response, callback) => {
        if (res) {
          res.setEncoding('binary')
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            callback(null, Buffer.from(data, 'binary'))
          })
        }
      })
    expect(response.headers['content-disposition']).toEqual(`attachment; filename="${messageId}.${extension}"`)
    expect(response.headers['content-type']).toContain(mimetype)
  })
})
