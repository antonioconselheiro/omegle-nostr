import { Injectable } from '@angular/core';
import { NostrUser } from '@domain/nostr-user';
import { GlobalConfigService } from '@shared/global-config/global-config.service';
import { Event, EventTemplate, finalizeEvent, kinds, nip04 } from 'nostr-tools';

@Injectable({
  providedIn: 'root'
})
export class NostrEventFactory {

  constructor(
    private readonly globalConfigService: GlobalConfigService
  ) { }

  private getCurrentTimestamp(): number {
    const oneMillisecond = 1000;
    return Math.floor(Date.now() / oneMillisecond);
  }

  /**
   * @param expireIn time in seconds to expire, default to 60
   * @returns expiration timestamp
   */
  private getExpirationTimestamp(
    expireIn = this.globalConfigService.WANNACHAT_STATUS_DEFAULT_TIMEOUT_IN_MS
  ): string {
    const oneMillisecond = 1000;
    const expirationTimestamp = Math.floor(Date.now() / oneMillisecond) + expireIn;
    return String(expirationTimestamp);
  }

  /**
   * NIP 4
   * https://github.com/nostr-protocol/nips/blob/master/04.md
   * https://github.com/nbd-wtf/nostr-tools/blob/master/nip04.test.ts
   */
  async createEncryptedDirectMessage(you: Required<NostrUser>, stranger: NostrUser, message: string): Promise<Event> {
    const encriptedMessage = await nip04.encrypt(you.pubkey, stranger.pubkey, message);

    const unsignedEvent: EventTemplate = {
      kind: kinds.EncryptedDirectMessage,
      content: encriptedMessage,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      created_at: this.getCurrentTimestamp(),
      tags: [
        ['p', stranger.pubkey]
      ]
    };

    const verifiedEvent = finalizeEvent(
      unsignedEvent, you.privateKey
    );

    return Promise.resolve(verifiedEvent);
  }

  /**
   * NIP 38
   * https://github.com/nostr-protocol/nips/blob/master/38.md
   */
  createWannaChatUserStatus(user: Required<NostrUser>): Event {
    return this.createUserStatus(user, 'wannachat', [
        ['expiration', this.getExpirationTimestamp()],
        ['t', 'wannachat']
      ]);
  }

  createDisconnectedUserStatus(user: Required<NostrUser>): Event {
    return this.createUserStatus(user, 'disconnected');
  }

  createTypingUserStatus(user: Required<NostrUser>): Event {
    return this.createUserStatus(user, 'typing');
  }

  createChatingUserStatus(you: Required<NostrUser>, strange: NostrUser): Event {
    return this.createUserStatus(you, 'chating', [
      [ 'p', strange.pubkey ],
      [ 't', 'chating' ]
    ]);
  }

  cleanUserStatus(user: Required<NostrUser>): Event {
    return this.createUserStatus(user, '');
  }

  private createUserStatus(user: Required<NostrUser>, status: string, tag?: string[][]): Event {
    const tags = [
      ['d', 'general'],
      ...(tag || []),
      ['t', 'omegle']
    ];

    const unsignedEvent = {
      id: '',
      kind: kinds.UserStatuses,
      content: status,
      pubkey: user.pubkey,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      created_at: this.getCurrentTimestamp(),
      tags
    };

    const verifiedEvent = finalizeEvent(
      unsignedEvent as object as EventTemplate, user.privateKey
    );

    return verifiedEvent;
  }
}
