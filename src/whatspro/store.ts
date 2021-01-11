import { sendRPCMessage } from '../messageBroker';
import { Integrations } from '../models';
import { Customers } from './models';

export interface IUser {
  id: string;
  created_timestamp: string;
  name: string;
  screen_name: string;
  profile_image_url: string;
  profile_image_url_https: string;
}

export const getOrCreateCustomer = async (
  phoneNumber: string,
  name: string,
  instanceId: string,
  avatarUrl: string = '',
) => {
  const integration = await Integrations.getIntegration({
    $and: [{ whatsProInstanceId: instanceId }, { kind: 'whatspro' }],
  });

  const query = {
    $or: [{ phoneNumber }],
  };

  if (phoneNumber.indexOf('55') === 0) {
    // Brazilian new mobile phone number issue fix because WhatsApp still uses the old format for some users
    if (phoneNumber.length === 12) {
      query.$or.push({ phoneNumber: phoneNumber.substr(0, 4) + '9' + phoneNumber.substr(5) });
    } else if (phoneNumber.length === 13) {
      query.$or.push({ phoneNumber: phoneNumber.substr(0, 4) + phoneNumber.substr(5) });
    }
  }

  let customer = await Customers.findOne(query);

  if (!customer) {
    try {
      customer = await Customers.create({
        phoneNumber,
        name,
        integrationId: integration.id,
      });
    } catch (e) {
      throw new Error(e.message.includes('duplicate') ? 'Concurrent request: customer duplication' : e);
    }
  }

  // save on api
  try {
    const apiCustomerResponse = await sendRPCMessage({
      action: 'get-create-update-customer',
      payload: JSON.stringify({
        integrationId: integration.erxesApiId,
        firstName: name,
        phones: [phoneNumber],
        primaryPhone: phoneNumber,
        isUser: true,
        isOnline: true,
        avatar: avatarUrl,
      }),
    });
    customer.erxesApiId = apiCustomerResponse._id;
    await customer.save();
  } catch (e) {
    await Customers.deleteOne({ _id: customer._id });
    throw new Error(e);
  }

  return customer;
};
