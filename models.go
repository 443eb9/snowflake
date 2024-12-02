package main

import (
	"fmt"
	"image/color"
	"os"
	"time"

	"github.com/google/uuid"
)

const ProjectFile = "snowflake.json"

type WebUUID string

func (id WebUUID) ToUUID() (uuid.UUID, error) {
	return uuid.Parse(string(id))
}

type WebHexColor string

type Resources struct {
	Library Library
	Lookup  ResourcesLookup
}

func NewResources(lib Library) Resources {
	folders := make(map[uuid.UUID]*Folder)
	assets := make(map[uuid.UUID]*Asset)
	tags := make(map[uuid.UUID]Tag)
	containsTags := make(map[uuid.UUID][]*Asset)

	var collectFolder func(parent *Folder)
	collectFolder = func(parent *Folder) {
		folders[parent.Meta.Id] = parent

		for i := 0; i < len(parent.Data); i++ {
			asset := &parent.Data[i]
			assets[asset.Meta.Id] = asset

			for _, tag := range asset.Tags {
				tags[tag.Id] = tag
				containsTags[tag.Id] = append(containsTags[tag.Id], asset)
			}
		}

		for i := 0; i < len(parent.SubFolders); i++ {
			collectFolder(&parent.SubFolders[i])
		}
	}

	collectFolder(&lib.RootFolder)

	return Resources{lib, ResourcesLookup{folders, assets, tags, containsTags}}
}

type ResourcesLookup struct {
	Folders      map[uuid.UUID]*Folder
	Assets       map[uuid.UUID]*Asset
	Tags         map[uuid.UUID]Tag
	ContainsTags map[uuid.UUID][]*Asset
}

type Library struct {
	RootFolder Folder   `json:"rootFolder"`
	RootPath   string   `json:"rootPath"`
	Meta       MetaData `json:"meta"`
}

type Folder struct {
	Src        string   `json:"src"`
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
	Src        string      `json:"src"`
	Data       []AssetRef  `json:"data"`
	SubFolders []WebUUID   `json:"subFolders"`
	Meta       WebMetaData `json:"meta"`
}

func (folder *Folder) ToRef() FolderRef {
	subFolders := make([]WebUUID, len(folder.SubFolders))
	for index, subFolder := range folder.SubFolders {
		subFolders[index] = subFolder.Meta.ToWeb().Id
	}

	assetRefs := make([]AssetRef, len(folder.Data))
	for index, asset := range folder.Data {
		assetRefs[index] = asset.ToRef()
	}

	return FolderRef{folder.Src, assetRefs, subFolders, folder.Meta.ToWeb()}
}

type AssetType int

const (
	FolderAsset  = AssetType(0)
	ImageAsset   = AssetType(1)
	UnknownAsset = AssetType(-1)
)

var imageAssetExts = map[string]int{".png": 1, ".jpg": 1}

func GuessAssetType(s string) AssetType {
	switch {
	case imageAssetExts[s] != 0:
		return ImageAsset
	}
	return UnknownAsset
}

type Asset struct {
	Src  string   `json:"src"`
	Tags []Tag    `json:"tags"`
	Meta MetaData `json:"meta"`
}

type AssetRef struct {
	Src  string      `json:"src"`
	Tags []TagRef    `json:"tags"`
	Meta WebMetaData `json:"meta"`
}

func (a *AssetRef) ToAsset() (*Asset, error) {
	tags := make([]Tag, len(a.Tags))
	for index, tag := range a.Tags {
		t, err := tag.ToTag()
		if err != nil {
			return nil, err
		}
		tags[index] = *t
	}

	metadata, err := a.Meta.ToMetaData()
	if err != nil {
		return nil, err
	}

	return &Asset{
		a.Src,
		tags,
		*metadata,
	}, nil
}

func (a *Asset) ToRef() AssetRef {
	tagRefs := make([]TagRef, len(a.Tags))
	for index, tag := range a.Tags {
		tagRefs[index] = tag.ToRef()
	}

	return AssetRef{a.Src, tagRefs, a.Meta.ToWeb()}
}

type Tag struct {
	Id    uuid.UUID  `json:"id"`
	Name  string     `json:"name"`
	Color color.RGBA `json:"color"`
}

type TagRef struct {
	Id    WebUUID     `json:"id"`
	Name  string      `json:"name"`
	Color WebHexColor `json:"color"`
}

func (tag *TagRef) ToTag() (*Tag, error) {
	id, err := tag.Id.ToUUID()
	if err != nil {
		return nil, err
	}

	col := color.RGBA{A: 255}
	c, err := fmt.Sscanf(string(tag.Color), "%02x%02x%02x", &col.R, &col.G, &col.B)
	if c != 3 || err != nil {
		return nil, err
	}

	return &Tag{id, tag.Name, col}, nil
}

func (tag *Tag) ToRef() TagRef {
	return TagRef{
		WebUUID(tag.Id.String()),
		tag.Name,
		RGBAColorToHex(tag.Color),
	}
}

type MetaData struct {
	Id         uuid.UUID `json:"id"`
	Type       AssetType `json:"type"`
	Name       string    `json:"name"`
	ModifiedAt time.Time `json:"modified_at"`
}

type WebMetaData struct {
	Id         WebUUID   `json:"id"`
	Type       AssetType `json:"type"`
	Name       string    `json:"name"`
	ModifiedAt time.Time `json:"modified_at"`
}

func NewMetaData(fileInfo os.FileInfo, ext string) (MetaData, error) {
	id, err := uuid.NewUUID()
	if err != nil {
		return MetaData{}, err
	}

	return MetaData{
		id,
		GuessAssetType(ext),
		fileInfo.Name(),
		fileInfo.ModTime(),
	}, nil
}

func (data WebMetaData) ToMetaData() (*MetaData, error) {
	id, err := data.Id.ToUUID()
	if err != nil {
		return nil, err
	}

	return &MetaData{
		id,
		data.Type,
		data.Name,
		data.ModifiedAt,
	}, nil
}

func (data MetaData) ToWeb() WebMetaData {
	return WebMetaData{
		WebUUID(data.Id.String()),
		data.Type,
		data.Name,
		data.ModifiedAt,
	}
}

func RGBAColorToHex(color color.RGBA) WebHexColor {
	return WebHexColor(fmt.Sprintf("%X%X%X%X", color.R, color.G, color.B, color.A))
}
