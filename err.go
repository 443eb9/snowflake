package main

import (
	"fmt"

	"github.com/google/uuid"
)

type LibraryNotInitializedError struct{}

func (e LibraryNotInitializedError) Error() string {
	return "Library not initialized yet. Please open or initialize one first."
}

type FolderNotFoundError struct {
	id uuid.UUID
}

func (e FolderNotFoundError) Error() string {
	return fmt.Sprintf("Cannot find folder %v", e.id)
}

type AssetNotFoundError struct {
	id uuid.UUID
}

func (e AssetNotFoundError) Error() string {
	return fmt.Sprintf("Cannot find folder %v", e.id)
}
