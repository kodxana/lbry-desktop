// @flow
const VideoJsFunctions = ({
  source,
  sourceType,
  videoJsOptions,
  isAudio,
}: {
  source: string,
  sourceType: string,
  videoJsOptions: Object,
  isAudio: boolean,
}) => {
  function detectFileType() {
    // $FlowFixMe
    return new Promise(async (res, rej) => {
      try {
        const response = await fetch(source, { method: 'HEAD', cache: 'no-store' });

        // Temp variables to hold results
        let finalType = sourceType;
        let finalSource = source;

        // Override type if we receive an HLS/DASH manifest via redirect or the source already points to one.
        // do we need to check if explicitly redirected
        // or is checking extension only a safer method
        if (response && response.redirected && response.url && response.url.endsWith('m3u8')) {
          finalType = 'application/x-mpegURL';
          finalSource = response.url;
        }

        // Detect DASH (.mpd)
        const urlToCheck = (response && response.redirected && response.url) || source;
        if (urlToCheck && /\.mpd(\?.*)?$/i.test(urlToCheck)) {
          finalType = 'application/dash+xml';
          finalSource = urlToCheck;
        }

        // Modify video source in options
        videoJsOptions.sources = [
          {
            src: finalSource,
            type: finalType,
          },
        ];

        return res(videoJsOptions);
      } catch (error) {
        return rej(error);
      }
    });
  }

  // TODO: can remove this function as well
  // Create the video DOM element and wrapper
  function createVideoPlayerDOM(container: any) {
    if (!container) return;

    // This seems like a poor way to generate the DOM for video.js
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-vjs-player', 'true');
    const el = document.createElement(isAudio ? 'audio' : 'video');
    el.className = 'video-js vjs-big-play-centered ';
    try { el.setAttribute('crossorigin', 'anonymous'); } catch (e) {}
    wrapper.appendChild(el);

    container.appendChild(wrapper);

    return el;
  }

  return {
    detectFileType,
    createVideoPlayerDOM,
  };
};

export default VideoJsFunctions;
