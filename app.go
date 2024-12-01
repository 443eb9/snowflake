package main

import (
	"context"
	"encoding/json"
	"os"
	"path"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	library Library
	ctx     context.Context
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

	a.library = result
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

	rootFolder, err := collectFolder(path.Dir(root), info.Name())
	if err != nil {
		return err
	}

	a.library = Library{rootFolder.SubFolder, rootFolder.Meta}

	return nil
}

func collectFolder(parent, entry string) (*Folder, error) {
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
			asset := Asset{path.Join(folderPath, entry.Name()), meta}
			data = append(data, asset)
		} else {
			folder, err := collectFolder(folderPath, entry.Name())
			if err != nil {
				return nil, err
			}
			subFolders = append(subFolders, *folder)
		}
	}

	return &Folder{data, subFolders, folderMeta}, nil
}
