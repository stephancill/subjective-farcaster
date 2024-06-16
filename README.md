# Subjective Farcaster Metrics

This is a collection of cached endpoints which can be used to calculate the number of likes on a cast or the number of followers of a user filtered based on 2 degrees of separation from the viewer i.e. only counting interactions from the viewer's follows or the follows of the viewer's follows.

## Endpoints

- `GET /cast?fid=&hash=&viewerFid=` - Returns the number of likes on a cast

Sample

```
GET /cast?fid=1689&hash=0x5201d906379adb1265bd5bb9a38ef09fd37f0972&viewerFid=1689
```

```
{
  "allLinksCount": 47369,
  "intersectionCount": 24,
  "intersectionByDepth": {
    "0": 11,
    "1": 13
  },
  "linksByDepthCounts": {
    "0": 883,
    "1": 46486
  }
}
```

- `GET /user?fid=&viewerFid=` - Returns the number of followers of a user

Sample

```
GET /followers?fid=3&viewerFid=1689
```

```
{
  "allLinksCount": 47369,
  "intersectionCount": 40382,
  "intersectionByDepth": {
    "0": 804,
    "1": 39578
  },
  "linksByDepthCounts": {
    "0": 883,
    "1": 46486
  }
}
```

## Development

Copy the `.env.sample` file to `.env` and fill in the required values.

```
cp .env.sample .env
```

```
yarn install
```

```
yarn start
```
