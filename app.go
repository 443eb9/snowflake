package main

import (
	"context"
	"encoding/json"
	"os"
	"path"

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

	res := NewResources(result)
	a.resources = &res
	return nil
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
		folderMeta, err := NewMetaData(folderInfo)
		if err != nil {
			return nil, err
		}

		var data []Asset
		var subFolders []Folder
		for _, entry := range entries {
			info, err := entry.Info()
			if err != nil {
				return nil, err
			}
			meta, err := NewMetaData(info)
			if err != nil {
				return nil, err
			}

			if info.IsDir() {
				folder, err := collectFolder(folderPath, entry.Name())
				if err != nil {
					return nil, err
				}
				subFolders = append(subFolders, *folder)
			} else {
				asset := Asset{path.Join(folderPath, entry.Name()), meta}
				data = append(data, asset)
			}
		}

		return &Folder{data, subFolders, folderMeta}, nil
	}

	rootFolder, err := collectFolder(path.Dir(root), info.Name())
	if err != nil {
		return err
	}

	res := NewResources(Library{*rootFolder, rootFolder.Meta})
	a.resources = &res

	return nil
}

func (a *App) GetRootFolder() (*FolderRef, error) {
	if a.resources == nil {
		return nil, LibraryNotInitializedError{}
	}

	res := a.resources.Library.RootFolder.ToRef()
	return &res, nil
}

func (a *App) GetFolder(id uuid.UUID) (*FolderRef, error) {
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
