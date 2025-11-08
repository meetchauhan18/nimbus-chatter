import Dexie from 'dexie';

export const chatDB = new Dexie('NimbusDatabase');

chatDB.version(1).stores({
  messages: 'id, conversationId, clientMsgId, createdAt',
  conversations: 'id, lastMessageAt',
  users: 'id, phone',
  pendingMessages: 'clientMsgId, createdAt'
});

export default chatDB;
