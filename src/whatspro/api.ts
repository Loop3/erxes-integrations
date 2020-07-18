import * as request from 'request-promise';
import { getEnv } from '../utils';
interface IContact {
  _id: string;
  name: string;
  phone: string;
}

interface IMessage {
  _id: string;
  contact: IContact;
  message: string;
  fileUrl: string;
  type: string;
  self: string;
  identificator: string;
  status: number;
}

const base_url = 'https://whatspro.me';

export const reply = (receiverId: string, content: string, token: string): Promise<IMessage> => {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      url: `${base_url}/api/message/fast?token=${token}`,
      body: {
        phone: receiverId,
        message: content,
      },
      json: true,
    };
    request
      .post(requestOptions)
      .then(res => {
        resolve(res);
      })
      .catch(e => {
        reject(e);
      });
  });
};

export const sendFile = (receiverId: string, body: string, src: string, token: string): Promise<IMessage> => {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      url: `${base_url}/api/message/fast?token=${token}`,
      body: {
        phone: receiverId,
        message: body,
        fileUrl: src,
      },
      json: true,
    };
    request
      .post(requestOptions)
      .then(res => {
        resolve(res);
      })
      .catch(e => {
        reject(e);
      });
  });
};

export const setupInstance = (integrationId: string, token: string): Promise<void> => {
  const webhookUrl = `${getEnv({ name: 'DOMAIN' })}/whatspro/webhook?integrationId=${integrationId}`;
  const requestOptions = {
    url: `${base_url}/api/message/callback?token=${token}&url=${webhookUrl}`,
    body: {},
    json: true,
  };

  return request.post(requestOptions);
};
