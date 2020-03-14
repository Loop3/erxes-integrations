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

export const getOrCreateCustomer = async (phoneNumber: string, name: string, instanceId: string) => {
  const integration = await Integrations.getIntegration({
    $and: [{ whatsProInstanceId: instanceId }, { kind: 'whatspro' }],
  });

  let customer = await Customers.findOne({ phoneNumber });

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
