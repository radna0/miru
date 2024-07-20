// make request to "http://localhost:64339/webtorrent/374ff33f0fae5206c693c7c7e0bd7acc88ef6ad0/[SubsPlease] Sousou no Frieren - 01 (1080p) [F02B9CEE].mkv"

// Using fetch API
fetch(
  'http://localhost:64339/webtorrent/544dd5563e4e2d7f979b991a65ac4bfffdcb1b82/[SubsPlease] Sousou no Frieren - 02 (1080p) [E5A85899].mkv'
)
  .then((response) => {
    console.log('Response:', response);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.blob(); // or response.json() if expecting JSON
  })
  .then((data) => {
    // Handle the data, e.g., create a URL and display the video
    const videoUrl = URL.createObjectURL(data);
    console.log('Video URL:', videoUrl);
    // You can use this URL to set the source of a video element, for example
    document.querySelector('video').src = videoUrl;
  })
  .catch((error) => {
    console.error('There has been a problem with your fetch operation:', error);
  });
