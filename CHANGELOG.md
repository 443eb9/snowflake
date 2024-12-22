# v0.2.0 [main branch, haven't released]

# What's New

- Removed folder structure.
- Total refactor of tag collections
  - Creating and modifying tags using context menu.
  - Grouping tags.
    - Tags will inherit the color of their groups.
    - Only one tag from the same group can exist on same asset.
    - Tags in same group can visually in different collections.
    - There can be multiple ungrouped tags exist on same asset.
    - When regrouping tags, you can choose to override or skip this incoming tag in settings.
    - Tags that are conflict with those already exist on the asset will be hidden. Or you can change setting to show them.
  - New tag picking ui.
    - Sort tags in groups.
- Rename when blurring input.
- New library initialization UI.
- Import folders as tags.
- Crash reporting.
  - Saving panic info into a `.txt` file.
  - Opening crash reports folder when app crashes.
- Changed folder of global application data.
- Allow changing window transparency style in settings.
- Show scrollbar when tree overflows at x axis.
- Resizable panels. Drag at borders to change panel size.

# What's Fixed

- App crashes on platforms other than windows 11, due to `unwrap`ing when applying transparency effect that the platform doesn't support.
- User settings not saved.

# v0.1.0

***First beta version.***

# What's New

- Loading screen on startup.
- Refined overlay panels.
- `glb` model support.
  - Importing into library.
  - View it with quick ref.
  - Caching preview image after first quick ref.
  - Taking screenshot.
  - Custom framerate.
- Display properties of assets: width, height etc.
- Double click behavior: Open with default app or quick ref.
- Press esc to close quick ref.
- About page
  - Check for update.
  - App version and repository.

# What's Fixed

- Adding tag to an asset *visually* duplicates it. (Although it will disappear after refresh)
- The selection area can go out of the container.
- Library data gets overridden if failed to parse.
- Quick ref for images can be larger than monitor if the image has a higher resolution than monitor.
- Native webview context menu pops up when right clicking on elements don't have `onContextMenu` defined.
- `Library` section is able to access even though no library is loaded.
- Settings won't update unless refresh the app.
- `svg` quick ref is not working.

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
