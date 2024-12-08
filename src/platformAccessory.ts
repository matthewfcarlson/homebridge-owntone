import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { OwntoneAccessoryConfig, OwntoneSpeakerPlatform } from './platform.js';

interface OwntoneAPIPlayerResponse {
  state: 'play' | 'pause' | 'stop';
  volume: number;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class OwntoneSpeakerAccessory {
  private service: Service;
  private speakerService: Service;
  private config: OwntoneAccessoryConfig;

  private currentPlayState: number | null = null;
  private currentVolume: number | null = null;
  private targetPlayState: number | null = null;
  private targetVolume: number | null = null;
  private currentLastUpdatedTimestamp: number | null = null;

  constructor(
    private readonly platform: OwntoneSpeakerPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.platform.log.debug('Constructed accessory:', accessory.displayName);
    this.config = accessory.context.device as OwntoneAccessoryConfig;
    // this.platform.log.debug('Constructed accessory:', accessory.context);
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Owntone')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial')
      .setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.library_name)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.version);

    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

    // Now create a new smart speaker service
    this.speakerService = this.accessory.getService(this.platform.Service.Speaker)
      || this.accessory.addService(this.platform.Service.Speaker);

    // give it a name
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Owntone Speaker');

    // create handlers for required characteristics
    // this.speakerService.getCharacteristic(this.platform.Characteristic.CurrentMediaState)
    //   .onGet(this.handleCurrentMediaStateGet.bind(this));

    // this.speakerService.getCharacteristic(this.platform.Characteristic.TargetMediaState)
    //   .onGet(this.handleTargetMediaStateGet.bind(this))
    //   .onSet(this.handleTargetMediaStateSet.bind(this));

    this.speakerService.getCharacteristic(this.platform.Characteristic.Volume)
      .onGet(this.handleVolumeGet.bind(this))
      .onSet(this.handleVolumeSet.bind(this));

    //  this.speakerService.getCharacteristic(this.platform.Characteristic.Active)
    //   .onGet(this.handleOnGet.bind(this))
    //   .onSet(this.handleOnSet.bind(this))

    this.speakerService.getCharacteristic(this.platform.Characteristic.Mute)
      .onGet(this.handleMuteGet.bind(this))
      .onSet(this.handleMuteSet.bind(this));
  }

  private async getCurrentPlayerState(): Promise<OwntoneAPIPlayerResponse> {
    if (this.currentPlayState === null
      || this.currentVolume === null
      || this.currentLastUpdatedTimestamp === null
      || (Date.now() - this.currentLastUpdatedTimestamp!) > 1000) {
      //gets the global playing state
      this.currentLastUpdatedTimestamp = Date.now();
      try {
        const player = await fetch(`${this.config.host}api/player`);
        const playerJSON = await player.json() as OwntoneAPIPlayerResponse;
        this.platform.log.debug('Player:', playerJSON);
        if (playerJSON.state === 'play') {
          this.currentPlayState = this.platform.Characteristic.CurrentMediaState.PLAY;
        } else if (playerJSON.state === 'pause') {
          this.currentPlayState = this.platform.Characteristic.CurrentMediaState.PAUSE;
        } else {
          this.currentPlayState = this.platform.Characteristic.CurrentMediaState.STOP;
        }
        this.currentVolume = playerJSON.volume;

      } catch (error) {
        this.platform.log.error('Error fetching player:', error);
      }
    }

    // return the current state
    return {
      state: this.currentPlayState === this.platform.Characteristic.CurrentMediaState.PLAY ?
        'play' : this.currentPlayState === this.platform.Characteristic.CurrentMediaState.PAUSE ? 'pause' : 'stop',
      volume: this.currentVolume || 0,
    };
  }

  /**
   * Handle requests to get the current value of the "Current Media State" characteristic
   */
  async handleCurrentMediaStateGet() {
    this.platform.log.debug('Triggered GET CurrentMediaState');

    const state = await this.getCurrentPlayerState();
    return state.state === 'play' ? this.platform.Characteristic.CurrentMediaState.PLAY :
      this.platform.Characteristic.CurrentMediaState.PAUSE;
  }


  /**
   * Handle requests to get the current value of the "Target Media State" characteristic
   */
  handleTargetMediaStateGet() {
    this.platform.log.debug('Triggered GET TargetMediaState');

    return this.targetPlayState || this.platform.Characteristic.TargetMediaState.STOP;
  }

  /**
   * Handle requests to set the "Target Media State" characteristic
   */
  async handleTargetMediaStateSet(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET TargetMediaState:', value);
    this.targetPlayState = value as number;
    // Set the state immediately by clearing the queue if we stop or pause
    if (value === this.platform.Characteristic.TargetMediaState.STOP || value === this.platform.Characteristic.TargetMediaState.PAUSE) {
      const url = `${this.config.host}/api/queue/clear`;
      try {
        const result = await fetch(url, { method: 'PUT' });
        this.platform.log.debug('Result from set STOP/PAUSE:', result);
      } catch (error) {
        this.platform.log.error('Error clearing queue:', error);
      }
    } else {
      // Try to play the queue
      const url = `${this.config.host}/api/player/play`;
      try {
        const result = await fetch(url, { method: 'PUT' });
        this.platform.log.debug('Result from set Play:', result);
      } catch (error) {
        this.platform.log.error('Error playing queue:', error);
      }
    }
  }

  /**
  * Handle requests to get the current value of the "Target Media State" characteristic
  */
  async handleVolumeGet() {
    this.platform.log.debug('Triggered GET Volume');

    const state = await this.getCurrentPlayerState();
    return state.volume;
  }

  /**
   * Handle requests to set the "Target Media State" characteristic
   */
  async handleVolumeSet(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET Volume:', value);
    this.targetVolume = value as number;
    // Set the volume immediately
    const url = `${this.config.host}api/player/volume?volume=${value}`;
    try {
      const result = await fetch(url, { method: 'PUT' });
      this.platform.log.debug('Result from set Volume:', result);
    } catch (error) {
      this.platform.log.error('Error setting volume:', error);
    }

  }

  /**
  * Handle requests to get the current value of the "On" characteristic
  */
  async handleOnGet() {
    this.platform.log.debug('Triggered GET On');
    const state = await this.getCurrentPlayerState();
    return state.state === 'play';
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleOnSet(value: CharacteristicValue) {
    this.handleTargetMediaStateSet(value ? this.platform.Characteristic.TargetMediaState.PLAY :
      this.platform.Characteristic.TargetMediaState.STOP);
  }

  /**
 * Handle requests to get the current value of the "On" characteristic
 */
  async handleMuteGet() {
    this.platform.log.debug('Triggered GET Mute');

    const state = await this.getCurrentPlayerState();
    return state.volume === 0 ? 1 : 0;
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  handleMuteSet(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET Mute:', value);
    // TODO: figure out what the volume was pre-mute, for now, just always set to zer0
    this.handleVolumeSet(value ? 0 : 1);
  }

}
