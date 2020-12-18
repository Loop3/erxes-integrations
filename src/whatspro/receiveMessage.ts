import * as Random from 'meteor-random';
import { sendRPCMessage } from '../messageBroker';
import Integrations from '../models/Integrations';
import { ConversationMessages, Conversations } from './models';
import { getOrCreateCustomer } from './store';
import { convertWAToHtml } from './helpers';

const receiveMessage = async (message: any, integrationId: string) => {
  const integration = await Integrations.getIntegration({
    $and: [{ erxesApiId: integrationId }, { kind: 'whatspro' }],
  });

  const instanceId = integration.whatsProInstanceId;

  if (message.self === 'out') {
    await ConversationMessages.updateOne({ mid: message._id }, { $set: { status: message.status } });

    // get conversation message
    const conversationMessage = await ConversationMessages.findOne({
      mid: message._id,
    });

    if (conversationMessage) {
      try {
        await sendRPCMessage({
          action: 'update-conversation-message',
          payload: JSON.stringify({
            id: conversationMessage.erxesApiId,
            status: message.status,
            createdAt: new Date(message.time),
          }),
        });
      } catch (e) {
        throw new Error(e);
      }
    } else {
      let phoneNumber = message.contact.phone;
      let name = message.contact.name;
      let avatarUrl = message.contact.avatarUrl;
      let content = convertWAToHtml(message.message);

      const customer = await getOrCreateCustomer(phoneNumber, name, instanceId, avatarUrl);

      let conversation = await Conversations.findOne({
        senderId: customer.id,
        instanceId,
      });

      if (!conversation) {
        try {
          conversation = await Conversations.create({
            timestamp: new Date(),
            senderId: customer.id,
            recipientId: phoneNumber,
            content,
            integrationId: integration._id,
            instanceId,
          });
        } catch (e) {
          throw new Error(e.message.includes('duplicate') ? 'Concurrent request: conversation duplication' : e);
        }
      }

      // save on api
      try {
        const apiConversationResponse = await sendRPCMessage({
          action: 'create-or-update-conversation',
          payload: JSON.stringify({
            customerId: customer.erxesApiId,
            integrationId: integration.erxesApiId,
            conversationId: conversation.erxesApiId,
            content,
          }),
        });

        conversation.erxesApiId = apiConversationResponse._id;

        await conversation.save();
      } catch (e) {
        await Conversations.deleteOne({ _id: conversation._id });
        throw new Error(e);
      }

      const id = Random.id();

      // save on integrations db
      try {
        await ConversationMessages.create({
          erxesApiId: id,
          conversationId: conversation._id,
          mid: message._id,
          timestamp: new Date(),
          content,
        });
      } catch (e) {
        if (e.message.includes('duplicate')) {
          return receiveMessage(message, integrationId);
        } else {
          throw new Error(e);
        }
      }

      // save message on api //Todo
      let attachments = [];
      if (!['chat', 'vcard'].includes(message.type)) {
        const attachment = { type: message.type, url: message.fileUrl };
        attachments = [attachment];
      }

      try {
        await sendRPCMessage({
          action: 'create-conversation-message',
          metaInfo: 'replaceContent',
          payload: JSON.stringify({
            _id: id,
            content,
            contentType: message.type === 'vcard' ? 'vcard' : undefined,
            attachments: (attachments || []).map(att => ({
              type: att.type,
              url: att.url,
            })),
            conversationId: conversation.erxesApiId,
            // customerId: customer.erxesApiId,
            isGroupMsg: message.isGroupMsg,
            isNewMsg: message.isNewMsg,
            isMe: true,
            createdAt: new Date(message.time),
            status: message.status,
          }),
        });
      } catch (e) {
        await ConversationMessages.deleteOne({ mid: message.mid });
        throw new Error(e);
      }
    }
  } else if (message.self === 'in') {
    let phoneNumber = message.contact.phone;
    let name = message.contact.name;
    let avatarUrl = message.contact.avatarUrl;
    let content = convertWAToHtml(message.message);

    if (message.isGroupMsg) {
      name = `${name} - Group`;
      content = `${content} - From ${message.sender.name || message.sender.pushname}`;
    }

    const customer = await getOrCreateCustomer(phoneNumber, name, instanceId, avatarUrl);

    let conversation = await Conversations.findOne({
      senderId: customer.id,
      instanceId,
    });

    if (!conversation) {
      try {
        conversation = await Conversations.create({
          timestamp: new Date(),
          senderId: customer.id,
          recipientId: phoneNumber,
          content,
          integrationId: integration._id,
          instanceId,
        });
      } catch (e) {
        throw new Error(e.message.includes('duplicate') ? 'Concurrent request: conversation duplication' : e);
      }
    }

    // save on api
    try {
      const apiConversationResponse = await sendRPCMessage({
        action: 'create-or-update-conversation',
        payload: JSON.stringify({
          customerId: customer.erxesApiId,
          integrationId: integration.erxesApiId,
          conversationId: conversation.erxesApiId,
          content,
        }),
      });

      conversation.erxesApiId = apiConversationResponse._id;

      await conversation.save();
    } catch (e) {
      await Conversations.deleteOne({ _id: conversation._id });
      throw new Error(e);
    }

    // get conversation message
    const conversationMessage = await ConversationMessages.findOne({
      mid: message._id,
    });

    if (!conversationMessage) {
      // save on integrations db
      try {
        await ConversationMessages.create({
          conversationId: conversation._id,
          mid: message._id,
          timestamp: new Date(),
          content,
        });
      } catch (e) {
        throw new Error(e.message.includes('duplicate') ? 'Concurrent request: conversation message duplication' : e);
      }

      // save message on api //Todo
      let attachments = [];
      if (!['chat', 'vcard'].includes(message.type)) {
        const attachment = { type: message.type, url: message.fileUrl };
        attachments = [attachment];
      }

      try {
        await sendRPCMessage({
          action: 'create-conversation-message',
          metaInfo: 'replaceContent',
          payload: JSON.stringify({
            content,
            contentType: message.type === 'vcard' ? 'vcard' : undefined,
            attachments: (attachments || []).map(att => ({
              type: att.type,
              url: att.url,
            })),
            conversationId: conversation.erxesApiId,
            customerId: customer.erxesApiId,
            isGroupMsg: message.isGroupMsg,
            isNewMsg: message.isNewMsg,
            createdAt: new Date(message.time),
          }),
        });
      } catch (e) {
        await ConversationMessages.deleteOne({ mid: message.mid });
        throw new Error(e);
      }
    }
  }
};

export default receiveMessage;
