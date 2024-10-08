import { NostrEvent, NostrFilter, NostrRelayCOUNT, NPool, NPoolOpts, NRelay1 } from '@nostrify/nostrify';
import { finalize, Observable, Subject } from 'rxjs';

export class MainNPool extends NPool {

  constructor() {
    super({
      open: (url) => new NRelay1(url),
      reqRouter: async (filters) => new Map([['ws://localhost:7777', filters]]),
      eventRouter: async () => ['ws://localhost:7777']
    });
  }

  observe(filters: Array<NostrFilter>): Observable<NostrEvent> {
    console.info('[[subscribe filter]]', filters);
    const abort = new AbortController();
    const subject = new Subject<NostrEvent>();

    (async () => {
      for await (const msg of this.req(filters, abort)) {
        if (msg[0] === 'CLOSED') {
          subject.error(msg);
          break;
        } else if (msg[0] === 'EVENT') {
          subject.next(msg[2]);
        }
      }
    })();
  
    return subject
      .asObservable()
      .pipe(
        finalize(() => {
          console.info('[[unsubscribe filter]]', filters);
          abort.abort();
        })
      );
  }

  async count(filters: NostrFilter[]): Promise<NostrRelayCOUNT[2]> {
    const routes = await this.getOpts().reqRouter(filters);
    if (routes.size < 1) {
      return Promise.reject(new Error('disconnected'));
    }

    const [[relay]] = Array.from(routes);
    console.info('asking count to ', relay);

    return (this.relay(relay) as NRelay1).count(filters, {
      signal: AbortSignal.timeout(1000)
    });
  }

  getOpts(): NPoolOpts {
    //  FIXME: open PR in nostrify asking to opts become protected
    return (this as any as { opts: NPoolOpts }).opts;
  }
}
