import { Component } from '@angular/core';
import { AudioProcesssorService } from '../services/audio-processsor.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  constructor(public audioService: AudioProcesssorService) {}
  public note$ = this.audioService.note$;
  toggleAudio() {
    this.audioService.toggleMic();
  }
}
