package main

import (
	"image/color"
	"os"
	"time"

	"github.com/google/uuid"
)

type Library struct {
	Folders []Folder `json:"folders"`
	Meta    MetaData `json:"meta"`
}

type Folder struct {
	Data      []Asset  `json:"data"`
	SubFolder []Folder `json:"subFolders"`
	Meta      MetaData `json:"meta"`
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
	Name  uuid.UUID  `json:"name"`
	Color color.RGBA `json:"color"`
}

type MetaData struct {
	Id         uuid.UUID `json:"id"`
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
