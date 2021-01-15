import * as request from 'request-promise';
import { getEnv } from '../utils';
import { WHATSPRO_API_URL } from './constants';
import { IMessage } from './models';

export const reply = (receiverId: string, messageId: string, content: string, token: string): Promise<IMessage> => {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      url: `${WHATSPRO_API_URL}/api/message/fast?token=${token}`,
      body: {
        id: messageId,
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

export const sendFile = (
  receiverId: string,
  messageId: string,
  body: string,
  src: string,
  token: string,
): Promise<IMessage> => {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      url: `${WHATSPRO_API_URL}/api/message/fast?token=${token}`,
      body: {
        id: messageId,
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
    url: `${WHATSPRO_API_URL}/api/webhook?token=${token}`,
    body: {
      url: webhookUrl,
      channel: 'whatsapp',
    },
    json: true,
  };

  return request.post(requestOptions);
};
