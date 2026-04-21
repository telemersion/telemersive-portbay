import { registerBackend } from '..'
import { parsePortaudio } from './portaudio'
import { parseCoreaudio } from './coreaudio'
import { parseNdi } from './ndi'
import { parseJack, parseWasapi } from './genericAudio'
import { parseTextureSender } from './textureSender'

// Maps each Backend key to the `uv` args that probe it and the parser that
// reads the resulting stdout. Platform-specific: on macOS textureCapture
// probes syphon; on Windows it probes spout. Both feed the same
// `textureCaptureRange` topic.
export function registerDefaultBackends(): void {
  const textureBackend = process.platform === 'win32' ? 'spout' : 'syphon'
  registerBackend('textureCapture', {
    args: ['-t', `${textureBackend}:help`],
    parse: (stdout) => parseTextureSender(stdout, textureBackend)
  })

  registerBackend('ndi', { args: ['-t', 'ndi:help'], parse: parseNdi })

  registerBackend('portaudioCapture', { args: ['-s', 'portaudio:help'], parse: parsePortaudio })
  registerBackend('portaudioReceive', { args: ['-r', 'portaudio:help'], parse: parsePortaudio })

  registerBackend('coreaudioCapture', { args: ['-s', 'coreaudio:help'], parse: parseCoreaudio })
  registerBackend('coreaudioReceive', { args: ['-r', 'coreaudio:help'], parse: parseCoreaudio })

  registerBackend('jackCapture', { args: ['-s', 'jack:help'], parse: parseJack })
  registerBackend('jackReceive', { args: ['-r', 'jack:help'], parse: parseJack })

  registerBackend('wasapiCapture', { args: ['-s', 'wasapi:help'], parse: parseWasapi })
  registerBackend('wasapiReceive', { args: ['-r', 'wasapi:help'], parse: parseWasapi })
}
