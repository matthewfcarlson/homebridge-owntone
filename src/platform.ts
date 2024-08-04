import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { OwntoneSpeakerAccessory } from './platformAccessory.js';

interface OwntoneSpeakerPlatformConfig extends PlatformConfig {
  name: string;
  serverip: string;
  serverport: string;
  debug: boolean;
}
interface OwntoneAPIConfigResponse {
  version: string;
  library_name: string;
  websocket_port: number;
}
export interface OwntoneAccessoryConfig extends OwntoneAPIConfigResponse {
  host: string;
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class OwntoneSpeakerPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logging,
    public readonly config: OwntoneSpeakerPlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.log.debug(JSON.stringify(config));
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {

    try {
      const host = `http://${this.config.serverip}:${this.config.serverport}/`;
      let configResponse = await fetch(`${host}api/config`);
      if (configResponse.status == 200) {
        let configJSON = await configResponse.json() as OwntoneAPIConfigResponse;
        this.log.debug("Found version: " + configJSON.version);
        const accessoryConfig: OwntoneAccessoryConfig = {
          host,
          ...configJSON,
        }
        const uuid = this.api.hap.uuid.generate(host);
        // see if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
        if (existingAccessory) {
          // the accessory already exists
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          // update the accessory context
          existingAccessory.context.device = accessoryConfig;
          existingAccessory.displayName = configJSON.library_name;
          existingAccessory.category = this.api.hap.Categories.SPEAKER;
          this.api.updatePlatformAccessories([existingAccessory]);
          // create the accessory handler for the restored accessory
          new OwntoneSpeakerAccessory(this, existingAccessory);
          // this.api.publishExternalAccessories(PLUGIN_NAME, [existingAccessory]);
        } else {
          this.log.info('Adding new accessory:', this.config.name);
          // create a new accessory
          const accessory = new this.api.platformAccessory("Owntone", uuid);
          // store a copy of the device object in the `accessory.context`
          accessory.context.device = accessoryConfig;
          accessory.category = this.api.hap.Categories.SPEAKER;
          accessory.displayName = configJSON.library_name;
          // create the accessory handler
          new OwntoneSpeakerAccessory(this, accessory);
          // link the accessory to your platform

          //this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }
    } catch (error) {
      this.log.error('Error fetching config:', error);
    }
  }
}
