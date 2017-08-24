# alorg-scripts

CLI tool to help with deploying an Alorg project to servers running docker.


```bash
# run via: yarn deploy
alorg-scripts deploy
```

# Configuration

Right now it's based off of an `alorg.json` file:

```json
{
  "name": "some name",
  "registry": "theoperatore/alorg",
  "tag": "latest",
  "servers": ["root@someplace.com"]
}
```

# License

MIT
