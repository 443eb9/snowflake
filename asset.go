package main

import (
	"net/http"
	"os"
	"strings"
)

type AssetLoader struct {
	http.Handler
}

func NewAssetLoader() *AssetLoader {
	return &AssetLoader{}
}

func (h *AssetLoader) ServeHTTP(res http.ResponseWriter, req *http.Request) {
	filePath := strings.TrimPrefix(req.URL.Path, "/")
	fileData, err := os.ReadFile(filePath)
	if err != nil {
		res.WriteHeader(http.StatusBadRequest)
		res.Write([]byte{})
	}

	res.Write(fileData)
}
