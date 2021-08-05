import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';
import { takeWhile, tap } from 'rxjs/operators';
// import {
//   AnalyserNode,
//   AudioContext,
//   GainNode,
//   IAnalyserNode,
//   IAudioContext,
//   IGainNode,
//   IMediaStreamAudioSourceNode,
// } from 'standardized-audio-context';
import { Note, TunerResponseMessage } from './interfaces';

@Injectable({
  providedIn: 'root',
})
export class AudioProcesssorService {
  // private audioContext: IAudioContext;
  // private analyser: IAnalyserNode<IAudioContext>;
  // private gainNode: IGainNode<IAudioContext>;
  // private mic: IMediaStreamAudioSourceNode<IAudioContext> | null = null;

  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private gainNode: GainNode;
  private mic: MediaStreamAudioSourceNode | null = null;

  public sendingAudioData: boolean;
  private fftSize = 4096;
  private worker: Worker;
  private readonly emptyNote: Note = {
    symbol: '',
    frequency: null,
    octave: null,
    cents: null,
  };
  private noteSub$ = new BehaviorSubject<Note>(this.emptyNote);
  public note$ = this.noteSub$.asObservable();
  RAFID: number;
  stream: MediaStream;

  constructor() {
    this.worker = new Worker(new URL('./tuner.worker', import.meta.url));
    this.worker.onmessage = ({ data }: TunerResponseMessage) => {
      this.noteSub$.next(data.note ?? this.emptyNote);
    };
  }
  createContext() {
    this.audioContext = new AudioContext({ latencyHint: 0, sampleRate: 48000 });
    this.analyser = new AnalyserNode(this.audioContext, {
      fftSize: this.fftSize,
    });
    this.gainNode = new GainNode(this.audioContext, {
      gain: 1,
      channelCount: 1,
      channelInterpretation: 'discrete',
    });
  }
  toggleMic() {
    if (this.sendingAudioData) {
      this.killMic();
    } else {
      this.requestUserDevices();
    }
  }
  async requestUserDevices() {
    this.createContext();
    const constraints: MediaStreamConstraints = {
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        latency: 0,
        noiseSuppression: false,
        sampleRate: 48000,
        sampleSize: 16,
      },
      video: false,
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.sendingAudioData = true;
    this.handleNewStream(this.stream);
  }

  handleNewStream(stream: MediaStream) {
    // For analyzing the audio stream
    this.mic = this.audioContext.createMediaStreamSource(stream);
    this.mic.connect(this.analyser);

    //For mixing back to the main output
    // this.mic.connect(this.gainNode);
    // this.audioContext.destination.channelCount = 1
    // this.gainNode.connect(this.audioContext.destination)

    this.RAFID = requestAnimationFrame(this.updatePitch.bind(this));
  }

  updatePitch() {
    if (this.sendingAudioData) {
      this.RAFID = requestAnimationFrame(this.updatePitch.bind(this));
    }
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(buffer);
    this.worker.postMessage({ buffer, sampleRate: this.audioContext.sampleRate, });
  }
  async killMic() {
    // Stop the loop
    cancelAnimationFrame(this.RAFID);
    this.RAFID = null;

    // Disconnect the nodes
    this.analyser.disconnect();
    this.gainNode.disconnect();
    this.analyser = null;
    this.gainNode = null;

    // Close the AudioContext
    await this.audioContext.close();
    this.audioContext = null;

    // Stop the mediaDevices
    this.stream.getTracks().forEach((track) => track.stop());
    this.noteSub$.next(this.emptyNote);


    // Reset the last be of stuff
    this.mic = null;
    this.sendingAudioData = false;
  }
}
