export type GmailPushNotification = {
  emailAddress: string;
  historyId: string;
  receivedAt: number;
};

export type GmailPushState = {
  watchHistoryId: string;
  processedHistoryId: string;
  notification: GmailPushNotification | null;
};

let gmailPushState: GmailPushState = {
  watchHistoryId: "",
  processedHistoryId: "",
  notification: null,
};

export function getGmailPushState(): GmailPushState {
  return gmailPushState;
}
