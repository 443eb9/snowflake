package main

import (
	"image/color"
	"os"
	"time"

	"github.com/google/uuid"
)

type WebUUID string

type Resources struct {
	Library Library
	Lookup  ResourcesLookup
}

func NewResources(lib Library) Resources {
	folders := make(map[uuid.UUID]*Folder)
	assets := make(map[uuid.UUID]*Asset)

	var collectFolder func(parent *Folder)
	collectFolder = func(parent *Folder) {
		folders[parent.Meta.Id] = parent

		for i := 0; i < len(parent.Data); i++ {
			asset := &parent.Data[i]
			assets[asset.Meta.Id] = asset
		}

		for i := 0; i < len(parent.SubFolders); i++ {
			collectFolder(&parent.SubFolders[i])
		}
	}

	collectFolder(&lib.RootFolder)

	return Resources{lib, ResourcesLookup{folders, assets}}
}

type ResourcesLookup struct {
	Folders map[uuid.UUID]*Folder
	Assets  map[uuid.UUID]*Asset
}

type Library struct {
	RootFolder Folder   `json:"rootFolder"`
	Meta       MetaData `json:"meta"`
}

type Folder struct {
	Data       []Asset  `json:"data"`
	SubFolders []Folder `json:"subFolders"`
	Meta       MetaData `json:"meta"`
}

type FolderTreeNode struct {
	SubFolders []FolderTreeNode `json:"subFolders"`
	Meta       WebMetaData      `json:"meta"`
}

func (folder *Folder) ToNode() FolderTreeNode {
	subFolders := make([]FolderTreeNode, len(folder.SubFolders))
	for index, subFolder := range folder.SubFolders {
		subFolders[index] = subFolder.ToNode()
	}

	return FolderTreeNode{subFolders, folder.Meta.ToWeb()}
}

type FolderRef struct {
	Data       []Asset     `json:"data"`
	SubFolders []WebUUID   `json:"subFolders"`
	Meta       WebMetaData `json:"meta"`
}

func (folder *Folder) ToRef() FolderRef {
	subFolders := make([]WebUUID, len(folder.SubFolders))
	for index, subFolder := range folder.SubFolders {
		subFolders[index] = subFolder.Meta.ToWeb().Id
	}

	return FolderRef{folder.Data, subFolders, folder.Meta.ToWeb()}
}

const (
	ImageAsset = iota
)

type Asset struct {
	Src  string   `json:"src"`
	Meta MetaData `json:"meta"`
}

type Tag struct {
	Id    uuid.UUID  `json:"id"`
	Name  string     `json:"name"`
	Color color.RGBA `json:"color"`
}

type MetaData struct {
	Id         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	ModifiedAt time.Time `json:"modified_at"`
}

type WebMetaData struct {
	Id         WebUUID   `json:"id"`
	Name       string    `json:"name"`
	ModifiedAt time.Time `json:"modified_at"`
}

func NewMetaData(fileInfo os.FileInfo) (MetaData, error) {
	id, err := uuid.NewUUID()
	if err != nil {
		return MetaData{}, err
	}

	return MetaData{
		id,
		fileInfo.Name(),
		fileInfo.ModTime(),
	}, nil
}

func (data MetaData) ToWeb() WebMetaData {
	return WebMetaData{WebUUID(data.Id.String()), data.Name, data.ModifiedAt}
}
