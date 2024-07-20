<script context="module">
  import { setContext } from 'svelte';
  import { writable } from 'simple-store-svelte';
  import SectionsManager from '@/modules/sections.js';
  9;

  export const search = writable({});

  const items = writable([]);
  export const key = writable({});
  export const best_anime_result = writable({});
</script>

<script>
  import Search, { searchCleanup } from '../components/Search.svelte';
  import Card from '../components/cards/Card.svelte';
  import { hasNextPage } from '@/modules/sections.js';
  import smoothScroll from '@/modules/scroll.js';
  import { debounce } from '@/modules/util.js';
  import { onDestroy, onMount } from 'svelte';
  import ErrorCard from '@/components/cards/ErrorCard.svelte';
  import animes from '@/data/split/data_0.json';
  import { getContext } from 'svelte';
  import { anilistClient } from '@/modules/anilist.js';
  import {
    playAnime,
    closeAnime,
  } from '@/views/TorrentSearch/TorrentModal.svelte';
  import IPC from '@/modules/ipc.js';

  function close() {
    $view = null;
  }

  function play(media, episode) {
    close();
    if (episode) return playAnime(media, episode);
  }

  let page = 0;
  items.value = [];
  let container = null;
  const view = getContext('view');
  const best_episodes_release = getContext('best_episodes_release');

  console.log(`V2: ${animes.length}`);

  async function processAnime(anime) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`V2: ${anime.title.userPreferred}`);
        const unsubscribeSearch = search.subscribe(async (value) => {
          console.log('V2: ', value);
          if (!value.search) {
            value.search = anime.title.userPreferred;
          }
          return value;
        });

        let media;
        const unsubscribeItem = items.subscribe(async (value) => {
          if (value?.length > 0) {
            media = await value[0].data;
            best_anime_result.set(media);
          }
        });

        const processEpisodes = async () => {
          const episodes = media.episodes;
          const episodeList = Array.from({ length: episodes }, (_, i) => ({
            episode: i + 1,
            image: null,
            summary: null,
            rating: null,
            title: null,
            length: null,
            airdate: null,
            airingAt: null,
          }));

          const load = async () => {
            const res = await fetch(
              'https://api.ani.zip/mappings?anilist_id=' + media.id
            );
            const { episodes, specialCount, episodeCount } = await res.json();
            let alEpisodes = episodeList;

            if (
              !(
                media.episodes &&
                media.episodes === episodeCount &&
                media.status === 'FINISHED'
              )
            ) {
              const settled = (await anilistClient.episodes({ id: media.id }))
                .data.Page?.airingSchedules;
              if (settled?.length) alEpisodes = settled;
            }

            for (const { episode, airingAt } of alEpisodes) {
              const alDate = new Date((airingAt || 0) * 1000);
              const needsValidation = !(
                !specialCount ||
                (media.episodes &&
                  media.episodes === episodeCount &&
                  episodes[Number(episode)])
              );
              const { image, summary, rating, title, length, airdate } =
                needsValidation
                  ? episodeByAirDate(alDate, episodes, episode)
                  : episodes[Number(episode)] || {};

              episodeList[episode - 1] = {
                episode,
                image,
                summary,
                rating,
                title,
                length: length || duration,
                airdate: +alDate || airdate,
                airingAt: +alDate || airdate,
              };
            }
          };

          await load();
          console.log('V4: ', episodes, episodeList);
          await playEpisodes(media, episodeList); // Play all episodes sequentially
          searchCleanup($search);
        };

        const unsubscribeAnime = best_anime_result.subscribe(async (value) => {
          if (
            value &&
            media &&
            value.id === media.id &&
            value.idMal === media.idMal
          ) {
            await processEpisodes();
          }
        });

        // Clean up subscription when resolved or rejected
        const cleanup = () => {
          onDestroy(unsubscribeSearch);
          onDestroy(unsubscribeItem);
          onDestroy(unsubscribeAnime);
        };

        // Wrap the cleanup in a Promise.resolve to handle it after resolution or rejection
        return () => {
          resolve(cleanup);
          reject(cleanup);
        };
      } catch (error) {
        console.error('Error processing anime:', error);
        reject(error);
      }
    });
  }

  async function playEpisodes(media, episodeList) {
    for (const episode of episodeList) {
      const hash = `${media.id}-${media.idMal}-${episode.episode}`;
      const savePath = `F:\\Isekai Torrent\\Downloads\\${hash}`;
      const hasDownloaded = await IPC.checkFileExistence(savePath);

      console.log('Checking download status:', hasDownloaded, savePath);

      if (hasDownloaded) continue;

      play(media, episode.episode);
      // Wait until the file exists and is downloaded
      await waitForFileExists(media, episode);
      console.log('_____________Download done_____________');
      closeAnime();
    }
  }

  async function waitForFileExists(media, episode) {
    return new Promise((resolve, reject) => {
      const handleDownloadStatus = (status) => {
        if (status === 'complete') {
          console.log('Download complete', episode.episode);
          resolve();
        } else if (status === 'error') {
          console.log('Download failed', episode.episode);
          reject(new Error('Download failed'));
        }
      };

      const load = debounce(async (value) => {
        const hash = `${media.id}-${media.idMal}-${episode.episode}`;
        const current_file = value[hash];

        if (current_file && !('hasDownloaded' in current_file)) {
          current_file.hasDownloaded = false;
          const { url, name, savePath } = current_file;
          const saveDir = `F:\\Isekai Torrent\\Downloads`;
          var current_format = url.substr(url.lastIndexOf('.') + 1);
          const fileName = `${hash}.${current_format}`;

          try {
            // check url for response.ok
            let response = null;
            while (!response || !response.ok) {
              response = await fetch(url);
              console.log('Response:', response);
              if (!response.ok) {
                console.log('Retrying download:', url);
              }
            }

            // If not downloaded, start the download process
            IPC.downloadMedia(url, fileName, saveDir);

            IPC.once('download-complete', () => {
              handleDownloadStatus('complete');
              current_file.hasDownloaded = true;
            });

            IPC.once('download-error', () => handleDownloadStatus('error'));
          } catch (error) {
            console.error('Error checking download status:', error);
            reject(error);
          }
        }
      }, 2000);

      // Subscribe to best_episodes_release
      const unsubscribe = best_episodes_release.subscribe((value) => {
        load(value);
      });

      // Clean up subscription when resolved or rejected
      const cleanup = () => {
        onDestroy(unsubscribe);
      };

      // Wrap the cleanup in a Promise.resolve to handle it after resolution or rejection
      return () => {
        resolve(cleanup);
        reject(cleanup);
      };
    });
  }

  const processing_animes = animes;

  // Series loop
  const processSequentially = async (animes) => {
    for (const anime of animes) {
      console.log(
        '____________________Processing anime:',
        anime.title.userPreferred
      );
      await processAnime(anime);
      console.log(
        '____________________Processed anime:',
        anime.title.userPreferred
      );
    }
  };

  processSequentially(processing_animes);

  function loadSearchData() {
    const load = $search.load || SectionsManager.createFallbackLoad();
    const nextData = load(++page, undefined, searchCleanup($search));
    $items = [...$items, ...nextData];
    return nextData[nextData.length - 1].data;
  }
  const update = debounce(() => {
    $key = {};
  }, 300);

  $: loadTillFull($key);

  let canScroll = true;

  async function loadTillFull(_key) {
    if (!container) return;
    const cachedKey = $key;
    canScroll = false;
    page = 0;
    items.value = [];
    hasNextPage.value = true;
    await loadSearchData();
    // eslint-disable-next-line no-unmodified-loop-condition
    while (
      hasNextPage.value &&
      container &&
      cachedKey === $key &&
      container.scrollHeight <= container.clientHeight
    ) {
      canScroll = false;
      await loadSearchData();
    }
    canScroll = true;
  }

  async function infiniteScroll() {
    if (
      canScroll &&
      $hasNextPage &&
      this.scrollTop + this.clientHeight > this.scrollHeight - 800
    ) {
      canScroll = false;
      await loadSearchData();
      canScroll = true;
    }
  }
  onDestroy(() => {
    if ($search.clearNext || $search.disableSearch) $search = {};
  });
  onMount(loadTillFull);
</script>

<div
  class="bg-dark h-full w-full overflow-y-scroll d-flex flex-wrap flex-row root overflow-x-hidden justify-content-center align-content-start"
  use:smoothScroll
  bind:this={container}
  on:scroll={infiniteScroll}
>
  <Search bind:search={$search} on:input={update} />
  <div
    class="w-full d-grid d-md-flex flex-wrap flex-row px-md-50 px-20 justify-content-center align-content-start"
  >
    {#key $key}
      {#each $items as card}
        <Card {card} />
      {/each}
      {#if [...$items]?.length}
        <ErrorCard promise={$items[0].data} />
      {/if}
    {/key}
  </div>
</div>

<style>
  .d-grid:has(.item.small-card) {
    grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)) !important;
  }
  .d-grid:has(.card.full-card) {
    grid-template-columns: repeat(auto-fill, minmax(52rem, 1fr)) !important;
  }
  .d-grid {
    grid-template-columns: repeat(auto-fill, minmax(36rem, 1fr));
  }
  @media (min-width: 769px) {
    .d-grid :global(.item.small-card) {
      width: 19rem !important;
    }
  }
</style>
