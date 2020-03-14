import { debugRequest, debugResponse, debugWhatsPro } from '../debuggers';

import { Integrations } from '../models';
import * as whatsProUtils from './api';
import { ConversationMessages, Conversations } from './models';
import receiveMessage from './receiveMessage';

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
    const { attachments, conversationId, content, integrationId } = req.body;

    if (attachments.length > 1) {
      throw new Error('You can only attach one file');
    }

    const conversation = await Conversations.getConversation({ erxesApiId: conversationId });

    const integration = await Integrations.findOne({ erxesApiId: integrationId });

    const recipientId = conversation.recipientId;
    const token = integration.whatsProToken;

    if (attachments.length !== 0) {
      for (const attachment of attachments) {
        const message = await whatsProUtils.sendFile(recipientId, content, attachment.url, token);
        await ConversationMessages.create({
          conversationId: conversation._id,
          mid: message._id,
          content,
        });
      }
    } else {
      const message = await whatsProUtils.reply(recipientId, content, token);
      await ConversationMessages.create({
        conversationId: conversation._id,
        mid: message._id,
        content,
      });
    }

    // save on integrations db

    debugResponse(debugWhatsPro, req);

    res.sendStatus(200);
  });
};

export default init;
