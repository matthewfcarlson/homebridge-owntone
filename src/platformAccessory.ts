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

  /**
   * Handle requests to get the current value of the "Current Media State" characteristic
   */
  handleCurrentMediaStateGet() {
    this.platform.log.debug('Triggered GET CurrentMediaState');

    // set this to a valid value for CurrentMediaState
    const currentValue = this.platform.Characteristic.CurrentMediaState.PLAY;

    return currentValue;
  }


  /**
   * Handle requests to get the current value of the "Target Media State" characteristic
   */
  handleTargetMediaStateGet() {
    this.platform.log.debug('Triggered GET TargetMediaState');

    // set this to a valid value for TargetMediaState
    const currentValue = this.platform.Characteristic.TargetMediaState.PLAY;

    return currentValue;
  }

  /**
   * Handle requests to set the "Target Media State" characteristic
   */
  handleTargetMediaStateSet(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET TargetMediaState:', value);
  }

  /**
  * Handle requests to get the current value of the "Target Media State" characteristic
  */
  handleVolumeGet() {
    this.platform.log.debug('Triggered GET Volume');

    // set this to a valid value for TargetMediaState
    const currentValue = 100;

    return currentValue;
  }

  /**
   * Handle requests to set the "Target Media State" characteristic
   */
  handleVolumeSet(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET Volume:', value);
  }

  /**
  * Handle requests to get the current value of the "On" characteristic
  */
  async handleOnGet() {
    this.platform.log.debug('Triggered GET On');
    //gets the global playing state
    try {
      const player = await fetch(`${this.config.host}api/player`);
      const playerJSON = await player.json() as OwntoneAPIPlayerResponse;
      this.platform.log.debug('Player:', playerJSON);
      if (playerJSON.state === 'play') {
        return 1;
      }
      return 0;
    } catch (error) {
      this.platform.log.error('Error fetching player:', error);
    }
    return 0;
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleOnSet(value: CharacteristicValue) {
    const url = (value) ? `${this.config.host}api/player/play` : `${this.config.host}api/player/pause`;
    this.platform.log.debug('Triggered SET On:', value, url);
    try{
      const result = await fetch(url, { method: 'PUT' });
      this.platform.log.debug('Triggered SET On:', value, result);
      if (result.status > 204 && value) {
        this.service.setCharacteristic(this.platform.Characteristic.On, false);
      }
    } catch (error) {
      this.service.setCharacteristic(this.platform.Characteristic.On, false);
    }
  }

  /**
 * Handle requests to get the current value of the "On" characteristic
 */
  handleMuteGet() {
    this.platform.log.debug('Triggered GET Mute');

    // set this to a valid value for On
    const currentValue = 1;

    return currentValue;
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  handleMuteSet(value: CharacteristicValue) {
    this.platform.log.debug('Triggered SET Mute:', value);
  }

}
