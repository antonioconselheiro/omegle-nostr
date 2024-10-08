import { Injectable } from '@angular/core';
import { NostrUser } from '@domain/nostr-user';
import { NostrEvent } from '@nostrify/nostrify';
import { GlobalConfigService } from '@shared/global-config/global-config.service';
import { EventTemplate, finalizeEvent, kinds, nip04 } from 'nostr-tools';

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
   * @param expireIn time in seconds to expire, default to 10
   * @returns expiration timestamp
   */
  private getExpirationTimestamp(
    expireIn = this.globalConfigService.WANNACHAT_STATUS_DEFAULT_TIMEOUT_IN_SECONDS
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
  async createEncryptedDirectMessage(you: Required<NostrUser>, stranger: NostrUser, message: string): Promise<NostrEvent> {
    const encriptedMessage = await nip04.encrypt(you.secretKey, stranger.pubkey, message);

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
      unsignedEvent, you.secretKey
    );

    return Promise.resolve(verifiedEvent);
  }

  /**
   * NIP 38
   * https://github.com/nostr-protocol/nips/blob/master/38.md
   */
  createWannaChatUserStatus(user: Required<NostrUser>): NostrEvent {
    return this.createUserStatus(user, 'wannachat', [
        ['expiration', this.getExpirationTimestamp()],
        ['t', 'wannachat']
      ]);
  }

  createDisconnectedUserStatus(user: Required<NostrUser>): NostrEvent {
    return this.createUserStatus(user, 'disconnected', [
      ['expiration', this.getExpirationTimestamp()]
    ]);
  }

  createTypingUserStatus(user: Required<NostrUser>): NostrEvent {
    return this.createUserStatus(user, 'typing');
  }

  createChatingUserStatus(you: Required<NostrUser>, strange: NostrUser): NostrEvent {
    return this.createUserStatus(you, 'chating', [
      [ 'p', strange.pubkey ],
      [ 't', 'chating' ]
    ]);
  }

  deleteUserHistory(you: Required<NostrUser>): NostrEvent {
    const template: EventTemplate = {
      kind: 5,
      tags: [
        ["k", String(kinds.EncryptedDirectMessage)],
        ["k", String(kinds.UserStatuses)],
        ['expiration', this.getExpirationTimestamp()]
      ],
      created_at: Math.floor(new Date().getTime() / 1000),
      content: ""
    }

    const verifiedEvent = finalizeEvent(
      template, you.secretKey
    );

    return verifiedEvent;
  }

  cleanUserStatus(user: Required<NostrUser>): NostrEvent {
    return this.createUserStatus(user, '');
  }

  private createUserStatus(user: Required<NostrUser>, status: string, tag?: string[][]): NostrEvent {
    const tags = [
      ['d', 'general'],
      ['t', 'omegle'],
      ...(tag || [])
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
      unsignedEvent as object as EventTemplate, user.secretKey
    );

    return verifiedEvent;
  }
}
