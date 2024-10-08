import { Injectable } from '@angular/core';
import { NostrUser } from '@domain/nostr-user';
import { NostrEvent } from '@nostrify/nostrify';
import { MainNPool } from '@shared/nostr/main.npool';
import { NostrEventFactory } from '@shared/nostr/nostr-event.factory';
import { Event } from 'nostr-tools';
import { FindStrangerNostr } from './find-stranger.nostr';
import { catchError, throwError, timeout } from 'rxjs';
import { GlobalConfigService } from '@shared/global-config/global-config.service';

@Injectable()
export class FindStrangerService {

  constructor(
    private nostrEventFactory: NostrEventFactory,
    private findStrangerNostr: FindStrangerNostr,
    private config: GlobalConfigService,
    private mainPool: MainNPool
  ) { }

  publish(event: Event): Promise<void> {
    return this.mainPool.event(event);
  }

  async searchStranger(me: Required<NostrUser>): Promise<NostrUser> {
    const wannaChat = await this.findStrangerNostr.queryChatAvailable();
    if (wannaChat) {
      console.info(new Date().toLocaleString(), 'inviting ', wannaChat.pubkey, ' to chat and listening confirmation');
      const listening = this.listenChatingConfirmation(wannaChat, me);
      await this.inviteToChating(me, wannaChat);
      const isChatingConfirmation = await listening;

      if (isChatingConfirmation) {
        return Promise.resolve(NostrUser.fromPubkey(wannaChat.pubkey));
      }
    }

    await this.publishWannaChatStatus(me);
    return new Promise(resolve => {
      const sub = this.findStrangerNostr
        .listenWannachatResponse(me)
        .pipe(
          timeout(this.config.WANNACHAT_STATUS_DEFAULT_TIMEOUT_IN_SECONDS * 1000),
          catchError(err => {
            sub.unsubscribe();
            this.searchStranger(me).then(stranger => resolve(stranger));
            return throwError(() => new err)
          })
        )
        .subscribe({
          next: event => {
            this.replyChatInvitation(event, me)
              .then(user => user && resolve(user));

            sub.unsubscribe();
          },
          error: err => console.error(err)
        });
    });
  }

  async replyChatInvitation(event: NostrEvent, me: Required<NostrUser>): Promise<NostrUser | void> {
    console.info(new Date().toLocaleString(), 'event was listen: ', event);
    console.info(new Date().toLocaleString(), 'it must be a chating invitation from ', event.pubkey, ', repling invitation...');

    await this.inviteToChating(me, event);
    console.info(new Date().toLocaleString(), 'replied... resolving... ');
    console.info(new Date().toLocaleString(), '[searchStranger] unsubscribe');
    return Promise.resolve(NostrUser.fromPubkey(event.pubkey));
  }

  private isChatingToMe(event: Event, me: Required<NostrUser>): boolean {
    console.info(new Date().toLocaleString(), 'is wannachat reply with chating? event: ', event);

    const result = event.tags
      .filter(([type]) => type === 'p')
      .find(([, pubkey]) => pubkey === me.pubkey) || [];

    console.info(new Date().toLocaleString(), 'is wannachat reply with chating?', !!result.length ? 'yes' : 'no');
    return !!result.length;
  }

  private inviteToChating(me: Required<NostrUser>, strangeStatus: Event): Promise<NostrEvent> {
    const stranger = NostrUser.fromPubkey(strangeStatus.pubkey);
    return this.publishChatInviteStatus(me, stranger);
  }

  private async listenChatingConfirmation(strangerEvent: Event, me: Required<NostrUser>): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      console.info(new Date().toLocaleString(), 'listening status update from: ', strangerEvent.pubkey);
      const subscription = this.findStrangerNostr
        .listenUserStatusUpdate(strangerEvent.pubkey)
        .subscribe(status => {
          if (status.id === strangerEvent.id && status.content === 'wannachat') {
            console.info(new Date().toLocaleString(), 'stranger #wannachat status was listen, ignoring and waiting new status...');
            return;
          }

          subscription.unsubscribe();
          console.info(new Date().toLocaleString(), '[listenUserStatusUpdate] unsubscribe');
          console.info(new Date().toLocaleString(), 'stranger ', strangerEvent.pubkey, ' update status: ', status);
          if (this.isChatingToMe(status, me)) {
            console.info(new Date().toLocaleString(), 'is "chating" status confirmed, resolved with true');
            resolve(true);
          } else {
            console.info(new Date().toLocaleString(), 'unexpected status was given, resolved with false, event: ', status);
            resolve(false);
          }
        });
    });
  }

  private async publishWannaChatStatus(user: Required<NostrUser>): Promise<NostrEvent> {
    const wannaChatStatus = this.nostrEventFactory.createWannaChatUserStatus(user);
    console.info(new Date().toLocaleString(), 'updating my status to: ', wannaChatStatus);
    await this.mainPool.event(wannaChatStatus);

    return Promise.resolve(wannaChatStatus);
  }

  private async publishChatInviteStatus(user: Required<NostrUser>, stranger: NostrUser): Promise<NostrEvent> {
    const chatingStatus = this.nostrEventFactory.createChatingUserStatus(user, stranger);
    console.info(new Date().toLocaleString(), 'updating my status to: ', chatingStatus);
    await this.mainPool.event(chatingStatus);

    return Promise.resolve(chatingStatus);
  }

  private async deleteUserHistory(user: Required<NostrUser>): Promise<void> {
    const deleteStatus = this.nostrEventFactory.deleteUserHistory(user);
    console.info(new Date().toLocaleString(), 'deleting user history');
    await this.mainPool.event(deleteStatus);
  }

  connect(): Required<NostrUser> {
    return NostrUser.create();
  }

  async disconnect(user: Required<NostrUser>): Promise<NostrEvent> {
    const disconnectStatus = this.nostrEventFactory.createDisconnectedUserStatus(user);
    console.info(new Date().toLocaleString(), 'updating my status to: ', disconnectStatus);
    await this.deleteUserHistory(user);
    await this.mainPool.event(disconnectStatus);

    return Promise.resolve(disconnectStatus);
  }
}
