package main

import (
	"context"
	"encoding/json"
	"os"
	"path"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	resources *Resources
	ctx       context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) LoadLibrary() error {
	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the main library file"})
	if err != nil {
		return err
	}

	data, err := os.ReadFile(file)
	if err != nil {
		return err
	}

	var result Library
	err = json.Unmarshal(data, &result)
	if err != nil {
		return err
	}

	result.RootPath = file
	res := NewResources(result)
	a.resources = &res
	return nil
}

func (a *App) SaveLibrary() error {
	bytes, err := json.Marshal(a.resources.Library)
	if err != nil {
		return err
	}

	return os.WriteFile(path.Join(a.resources.Library.RootPath, ProjectFile), bytes, 0644)
}

func (a *App) InitializeLibrary() error {
	root, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choose the library root"})
	if err != nil {
		return err
	}

	info, err := os.Stat(root)
	if err != nil {
		return err
	}

	if _, err := os.Stat(path.Join(root, ProjectFile)); os.IsExist(err) {
		return LibraryAlreadyExists{}
	}

	var collectFolder func(parent, name string) (*Folder, error)
	collectFolder = func(parent, entry string) (*Folder, error) {
		folderPath := path.Join(parent, entry)
		entries, err := os.ReadDir(folderPath)
		if err != nil {
			return nil, err
		}

		folderInfo, err := os.Stat(folderPath)
		if err != nil {
			return nil, err
		}

		folderMeta, err := NewMetaData(folderInfo, "")
		folderMeta.Type = FolderAsset
		if err != nil {
			return nil, err
		}

		var data []Asset
		var subFolders []Folder
		for _, entry := range entries {
			entryPath := path.Join(folderPath, entry.Name())
			info, err := entry.Info()
			if err != nil {
				return nil, err
			}

			meta, err := NewMetaData(info, path.Ext(entryPath))
			if err != nil {
				return nil, err
			}

			if info.IsDir() {
				meta.Type = FolderAsset
				folder, err := collectFolder(folderPath, entry.Name())
				if err != nil {
					return nil, err
				}
				subFolders = append(subFolders, *folder)
			} else {
				asset := Asset{entryPath, []Tag{}, meta}
				data = append(data, asset)
			}
		}

		sort.Slice(data, func(i, j int) bool {
			return data[i].Meta.Name < data[j].Meta.Name
		})
		sort.Slice(subFolders, func(i, j int) bool {
			return subFolders[i].Meta.Name < subFolders[j].Meta.Name
		})

		return &Folder{folderPath, data, subFolders, folderMeta}, nil
	}

	rootFolder, err := collectFolder(path.Dir(root), info.Name())
	if err != nil {
		return err
	}

	res := NewResources(Library{*rootFolder, root, rootFolder.Meta})
	a.resources = &res

	if err := a.SaveLibrary(); err != nil {
		return err
	}

	return nil
}

func (a *App) GetAbsPath(relative string) (*string, error) {
	base, err := os.Getwd()
	if err != nil {
		return nil, err
	}

	abs := strings.Map(func(r rune) rune {
		if r == '\\' {
			return '/'
		} else {
			return r
		}
	}, path.Join(base, relative))
	return &abs, nil
}

func (a *App) GetRootFolder() (*FolderRef, error) {
	if a.resources == nil {
		return nil, LibraryNotInitializedError{}
	}

	res := a.resources.Library.RootFolder.ToRef()
	return &res, nil
}

func (a *App) GetFolderRef(id uuid.UUID) (*FolderRef, error) {
	if a.resources == nil {
		return nil, LibraryNotInitializedError{}
	}

	folder := a.resources.Lookup.Folders[id]
	if folder == nil {
		return nil, FolderNotFoundError{id}
	}

	res := folder.ToRef()
	return &res, nil
}

func (a *App) GetFolderTree() (FolderTreeNode, error) {
	return a.resources.Library.RootFolder.ToNode(), nil
}

func (a *App) GetAssetRef(id uuid.UUID) (*AssetRef, error) {
	if a.resources == nil {
		return nil, LibraryNotInitializedError{}
	}

	asset := a.resources.Lookup.Assets[id]
	if asset == nil {
		return nil, AssetNotFoundError{id}
	}

	res := asset.ToRef()
	return &res, nil
}

func (a *App) GetAllTags() ([]TagRef, error) {
	if a.resources == nil {
		return nil, LibraryNotInitializedError{}
	}

	result := []TagRef{}
	for _, tag := range a.resources.Lookup.Tags {
		result = append(result, tag.ToRef())
	}

	return result, nil
}

func (a *App) ModifyTag(newTag TagRef) error {
	if a.resources == nil {
		return LibraryNotInitializedError{}
	}

	tag, err := newTag.ToTag()
	if err != nil {
		return err
	}

	a.resources.Lookup.Tags[tag.Id] = *tag
	return nil
}

func (a *App) ModifyTagsOfAsset(ty AssetType, id uuid.UUID, newTags []TagRef) error {
	tags := make([]Tag, len(newTags))
	for index, tag := range newTags {
		res, err := tag.ToTag()
		if err != nil {
			return err
		}

		tags[index] = *res
	}

	switch ty {
	case ImageAsset:
		a.resources.Lookup.Assets[id].Tags = tags
	}

	return nil
}

func (a *App) ModifyAsset(newAsset AssetRef) error {
	if a.resources == nil {
		return LibraryNotInitializedError{}
	}

	id, err := newAsset.Meta.Id.ToUUID()
	if err != nil {
		return err
	}

	asset, err := newAsset.ToAsset()
	if err != nil {
		return err
	}

	*a.resources.Lookup.Assets[id] = *asset
	return nil
}
