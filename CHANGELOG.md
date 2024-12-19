# v0.0.3 [main branch, haven't released]

# What's New

- Loading screen on startup.
- Refined overlay panels.
- `glb` model support.
  - Importing into library.
  - View it with quick ref.
  - Caching preview image after first quick ref.
  - Taking screenshot.
- Double click behavior: Open with default app or quick ref.

# What's Fixed

- Adding tag to an asset *visually* duplicates it. (Although it will disappear after refresh)
- The selection area can go out of the container.
- Library data gets overridden if failed to parse.
- Quick ref for images can be larger than monitor if the image has a higher resolution than monitor.
- Native webview context menu pops up when right clicking on elements don't have `onContextMenu` defined.
- `Library` section is able to access even though no library is loaded.

# v0.0.2

*Still, not production ready, yet.*

# What's New

- Library no longer accepts assets that it didn't recognize. For example, it won't import `.txt` or download `.html` .
- Exporting library while keeping your folder structure.
- Detecting duplicate assets using CRC(Cyclic Redundancy Check) hashing.
- New `src` property for assets. You can use this to mark the source of this asset.
- Asset statistics.
- Recycle bin.
  - Recover deleted objects.
  - Permanently delete object. This deletes the file in file system. If trying to permanently delete a folder, it's content and children will also be deleted, permanently, and you'll never be able to get that back.
- Update checking. We won't force you to update the app (although this is recommended) but will remind you on startup.
- Semi-transparent window.
- Open assets with default app.

# What's Fixed

- Application name not start with capital letter.

This version is not code-signed, so please allow this app to survive under your anti-virus software manually. 🥲

# v0.0.1

# Birthday of Snowflake 🎉 v0.0.1

*Not production ready!*

- Creating libraries from existing folder structure.
- Importing single assets or folders, or download from URLs.
- Tagging assets, find them faster when you need to draw start a themed project.

## Known Issues

- Selection area goes out of bound.
- Windows only.
- Imports files other than images will success but fails to display and won't warn user.
- Quick ref windows can't be resized using mouse scrolling. (This is an upstream issue.)

Feel free to open issues about bugs or feature requests!

Any contribution will be highly appreciated!
