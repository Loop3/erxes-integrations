import { ObjectId } from 'mongodb';
import { debugRequest, debugResponse, debugWhatsPro } from '../debuggers';
import { sendRPCMessage } from '../messageBroker';

import { Integrations } from '../models';
import * as whatsProUtils from './api';
import { ConversationMessages, Conversations, IMessage } from './models';
import receiveMessage from './receiveMessage';

function handleCreateResult(message: IMessage) {
  console.log(message);
}

async function handleCreateFailed(e: any) {
  const conversationMessage = await ConversationMessages.findOne({
    mid: e.options.body.id,
  });

  if (conversationMessage) {
    await ConversationMessages.updateOne({ mid: e.options.body.id }, { $set: { status: 98 } });

    try {
      await sendRPCMessage({
        action: 'update-conversation-message',
        payload: JSON.stringify({
          id: conversationMessage.erxesApiId,
          status: 98,
        }),
      });
    } catch (e) {
      const error = new Error(e);
      throw error;
    }
  }
}

const init = async app => {
  app.post('/whatspro/webhook', async (req, res, next) => {
    try {
      await receiveMessage(req.body, req.query.integrationId);
    } catch (e) {
      return next(new Error(e));
    }

    res.sendStatus(200);
  });

  app.post('/whatspro/create-integration', async (req, res, next) => {
    debugRequest(debugWhatsPro, req);

    const { integrationId, data } = req.body;
    const { instanceId, token } = JSON.parse(data);

    // Check existing Integration

    let integration = await Integrations.findOne({
      $and: [{ whatsProInstanceId: instanceId }, { kind: 'whatspro' }],
    });
    if (integration) {
      return next(`Integration already exists with this instance id: ${instanceId}`);
    }

    integration = await Integrations.create({
      kind: 'whatspro',
      erxesApiId: integrationId,
      whatsProInstanceId: instanceId,
      whatsProToken: token,
    });

    try {
      await whatsProUtils.setupInstance(integrationId, token);
    } catch (e) {
      next(new Error(e.message));
      await Integrations.deleteOne({ _id: integration.id });
    }

    return res.json({ status: 'ok' });
  });

  app.post('/whatspro/reply', async (req, res) => {
    const { attachments, conversationId, content, integrationId, messageId } = req.body;

    const conversation = await Conversations.getConversation({
      erxesApiId: conversationId,
    });

    const recipientId = conversation.recipientId;

    const integration = await Integrations.findOne({
      erxesApiId: integrationId,
    });

    const token = integration.whatsProToken;

    if (attachments.length !== 0) {
      for (const attachment of attachments) {
        const whatsProId = new ObjectId().toHexString();
        const body = attachments[attachments.length - 1] === attachment ? content : '';

        await ConversationMessages.create({
          conversationId: conversation._id,
          mid: whatsProId,
          content: body,
          erxesApiId: messageId,
        });

        whatsProUtils
          .sendFile(recipientId, whatsProId, body, attachment.url, token)
          .then(handleCreateResult)
          .catch(handleCreateFailed);
      }
    } else {
      const whatsProId = new ObjectId().toHexString();

      await ConversationMessages.create({
        conversationId: conversation._id,
        mid: whatsProId,
        content,
        erxesApiId: messageId,
      });

      whatsProUtils
        .reply(recipientId, whatsProId, content, token)
        .then(handleCreateResult)
        .catch(handleCreateFailed);
    }

    // save on integrations db

    debugResponse(debugWhatsPro, req);

    res.sendStatus(200);
  });
};

export default init;
