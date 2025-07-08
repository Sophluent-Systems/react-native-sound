import { NativeModules, NativeEventEmitter, Image} from 'react-native';
const RNSound = NativeModules.RNSound;
const IsAndroid = RNSound.IsAndroid;
const IsWindows = RNSound.IsWindows;
const eventEmitter = new NativeEventEmitter(RNSound);

let nextKey = 0;

const isRelativePath = (path) => {
  return !/^(\/|http(s?)|asset|file)/.test(path);
};

const calculateRelativeVolume = (volume, pan) => {
  // calculates a lower volume relative to the pan value
  const relativeVolume = (volume * (1 - Math.abs(pan)));
  return Number(relativeVolume.toFixed(1));
};

const setAndroidVolumes = (sound) => {
  // calculates the volumes for left and right channels
  if (sound._pan) {
    const relativeVolume = calculateRelativeVolume(sound._volume, sound._pan);
    if (sound._pan < 0) {
      // left is louder
      RNSound.setVolume(sound._key, sound._volume, relativeVolume);
    } else {
      // right is louder
      RNSound.setVolume(sound._key, relativeVolume, sound._volume);
    }
  } else {
    // no panning, same volume on both channels
    RNSound.setVolume(sound._key, sound._volume, sound._volume);
  }
};

class Sound {
  constructor(filename, basePath, onError, options) {
    let asset;
    if (typeof Image.resolveAssetSource === 'function') {
      asset = Image.resolveAssetSource(filename);
    } else if (Image.resolveAssetSource && typeof Image.resolveAssetSource.default === 'function') {
      asset = Image.resolveAssetSource.default(filename);
    }
    if (asset) {
      this._filename = asset.uri;
      onError = basePath;
    } else {
      this._filename = basePath ? `${basePath}/${filename}` : filename;

      if (IsAndroid && !basePath && isRelativePath(filename)) {
        this._filename = filename.toLowerCase().replace(/\.[^.]+$/, '');
      }
    }

    this._loaded = false;
    this._key = nextKey++;
    this._playing = false;
    this._duration = -1;
    this._numberOfChannels = -1;
    this._volume = 1;
    this._pan = 0;
    this._numberOfLoops = 0;
    this._speed = 1;
    this._pitch = 1;
    
    RNSound.prepare(this._filename, this._key, options || {}, (error, props) => {
      if (props) {
        if (typeof props.duration === 'number') {
          this._duration = props.duration;
        }
        if (typeof props.numberOfChannels === 'number') {
          this._numberOfChannels = props.numberOfChannels;
        }
      }
      if (error === null) {
        this._loaded = true;
        this.registerOnPlay();
      }
      onError && onError(error, props);
    });
  }

  registerOnPlay = () => {
    if (this.onPlaySubscription != null) {
      console.warn('On Play change event listener is already registered');
      return;
    }

    if (!IsWindows) {
      this.onPlaySubscription = eventEmitter.addListener(
        'onPlayChange',
        (param) => {
          const { isPlaying, playerKey } = param;
          if (playerKey === this._key) {
            if (isPlaying) {
              this._playing = true;
            } else {
              this._playing = false;
            }
          }
        },
      );
    }
  }

  isLoaded = () => {
    return this._loaded;
  }

  play = (onEnd) => {
    if (this._loaded) {
      RNSound.play(this._key, (successfully) => onEnd && onEnd(successfully));
    } else {
      onEnd && onEnd(false);
    }
    return this;
  }

  pause = (callback) => {
    if (this._loaded) {
      RNSound.pause(this._key, () => {
        this._playing = false;
        callback && callback();
      });
    }
    return this;
  }

  stop = (callback) => {
    if (this._loaded) {
      RNSound.stop(this._key, () => {
        this._playing = false;
        callback && callback();
      });
    }
    return this;
  }

  reset = () => {
    if (this._loaded && IsAndroid) {
      RNSound.reset(this._key);
      this._playing = false;
    }
    return this;
  }

  release = () => {
    if (this._loaded) {
      RNSound.release(this._key);
      this._loaded = false;
      if (!IsWindows) {
        if (this.onPlaySubscription != null) {
          this.onPlaySubscription.remove();
          this.onPlaySubscription = null;
        }
      }
    }
    return this;
  }

  getFilename = () => {
    return this._filename;
  }

  getDuration = () => {
    return this._duration;
  }

  getNumberOfChannels = () => {
    return this._numberOfChannels;
  }

  getVolume = () => {
    return this._volume;
  }

  getSpeed = () => {
    return this._speed;
  }

  getPitch = () => {
    return this._pitch;
  }

  setVolume = (value) => {
    this._volume = value;
    if (this._loaded) {
      if (IsAndroid) {
        setAndroidVolumes(this);
      } else {
        RNSound.setVolume(this._key, value);
      }
    }
    return this;
  }

  setPan = (value) => {
    this._pan = value;
    if (this._loaded) {
      if (IsWindows) {
        throw new Error('#setPan not supported on windows');
      } else if (IsAndroid) {
        setAndroidVolumes(this);
      } else {
        RNSound.setPan(this._key, value);
      }
    }
    return this;
  }

  getSystemVolume = (callback) => {
    if (!IsWindows) {
      RNSound.getSystemVolume(callback);
    }
    return this;
  }

  setSystemVolume = (value) => {
    if (IsAndroid) {
      RNSound.setSystemVolume(value);
    }
    return this;
  }

  getPan = () => {
    return this._pan;
  }

  getNumberOfLoops = () => {
    return this._numberOfLoops;
  }

  setNumberOfLoops = (value) => {
    this._numberOfLoops = value;
    if (this._loaded) {
      if (IsAndroid || IsWindows) {
        RNSound.setLooping(this._key, !!value);
      } else {
        RNSound.setNumberOfLoops(this._key, value);
      }
    }
    return this;
  }

  setSpeed = (value) => {
    this._speed = value;
    if (this._loaded) {
      if (!IsWindows) {
        RNSound.setSpeed(this._key, value);
      }
    }
    return this;
  }

  setPitch = (value) => {
    this._pitch = value;
    if (this._loaded) {
      if (IsAndroid) {
        RNSound.setPitch(this._key, value);
      }
    }
    return this;
  }

  getCurrentTime = (callback) => {
    if (this._loaded) {
      RNSound.getCurrentTime(this._key, callback);
    }
  }

  setCurrentTime = (value) => {
    if (this._loaded) {
      RNSound.setCurrentTime(this._key, value);
    }
    return this;
  }

  // android only
  setSpeakerphoneOn = (value) => {
    if (IsAndroid) {
      RNSound.setSpeakerphoneOn(this._key, value);
    }
  }

  // ios only
  // This is deprecated. Call the static one instead.
  setCategory = (value) => {
    Sound.setCategory(value, false);
  }

  isPlaying = () => {
    return this._playing;
  }

  // Static methods
  static enable = (enabled) => {
    RNSound.enable(enabled);
  }

  static enableInSilenceMode = (enabled) => {
    if (!IsAndroid && !IsWindows) {
      RNSound.enableInSilenceMode(enabled);
    }
  }

  static setActive = (value) => {
    if (!IsAndroid && !IsWindows) {
      RNSound.setActive(value);
    }
  }

  static setCategory = (value, mixWithOthers = false) => {
    if (!IsWindows) {
      RNSound.setCategory(value, mixWithOthers);
    }
  }

  static setMode = (value) => {
    if (!IsAndroid && !IsWindows) {
      RNSound.setMode(value);
    }
  }

  static setSpeakerPhone = (value) => {
    if (!IsAndroid && !IsWindows) {
      RNSound.setSpeakerPhone(value);
    }
  }

  static MAIN_BUNDLE = RNSound.MainBundlePath;
  static DOCUMENT = RNSound.NSDocumentDirectory;
  static LIBRARY = RNSound.NSLibraryDirectory;
  static CACHES = RNSound.NSCachesDirectory;
}

export default Sound;
