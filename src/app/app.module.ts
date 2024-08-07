import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ChatModule } from './pages/chat/chat.module';
import { NostrApiModule } from './shared/nostr-api/nostr-api.module';
import { GlobalConfigModule } from '@shared/global-config/global-config.module';
import { OmegleServiceModule } from '@shared/omegle-service/omegle-service.module';
import { NostrModule } from '@belomonte/nostr-ngx';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    ChatModule,
    BrowserModule,
    AppRoutingModule,
    GlobalConfigModule,
    OmegleServiceModule,
    NostrApiModule,
    NostrModule
  ],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule { }
