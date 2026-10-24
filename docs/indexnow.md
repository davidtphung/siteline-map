# IndexNow for Bing and Copilot

Siteline does not submit URLs on its own. After a deploy of siteline.nlt143.energy, send the public pages to IndexNow so Bing can pick them up for Bing search and Copilot grounding.

The key file is public:

https://siteline.nlt143.energy/bc08844cf5b5a04d130d728582cf137a.txt

The file body is the key `bc08844cf5b5a04d130d728582cf137a` and the response content type is `text/plain`. Confirm that URL returns 200 before submitting.

## Request

POST `https://www.bing.com/indexnow` or `https://api.indexnow.org/indexnow` with `Content-Type: application/json`.

```json
{
  "host": "siteline.nlt143.energy",
  "key": "bc08844cf5b5a04d130d728582cf137a",
  "keyLocation": "https://siteline.nlt143.energy/bc08844cf5b5a04d130d728582cf137a.txt",
  "urlList": [
    "https://siteline.nlt143.energy/",
    "https://siteline.nlt143.energy/about",
    "https://siteline.nlt143.energy/regions",
    "https://siteline.nlt143.energy/regions/ashburn",
    "https://siteline.nlt143.energy/regions/abilene",
    "https://siteline.nlt143.energy/regions/permian",
    "https://siteline.nlt143.energy/regions/carlsbad",
    "https://siteline.nlt143.energy/well-methodology",
    "https://siteline.nlt143.energy/llms.txt",
    "https://siteline.nlt143.energy/llms-full.txt"
  ]
}
```

A 200 or 202 means the batch was accepted. It does not mean the pages are already indexed. Bing Webmaster Tools is the place to check coverage after that.

The key is a public IndexNow token, not a secret. Do not put a hosting credential in this request.
