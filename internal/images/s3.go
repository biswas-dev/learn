package images

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Store stores images in an S3-compatible bucket (Backblaze B2, etc.)
type S3Store struct {
	client *s3.Client
	bucket string
}

func NewS3Store(endpoint, keyID, appKey, bucket string) (*S3Store, error) {
	// Extract region from B2 endpoint (e.g. "https://s3.ca-east-006.backblazeb2.com" → "ca-east-006")
	region := "us-east-1"
	if parts := strings.Split(endpoint, "."); len(parts) >= 3 {
		region = parts[1] // e.g. "ca-east-006"
	}

	client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       region,
		Credentials:  credentials.NewStaticCredentialsProvider(keyID, appKey, ""),
		UsePathStyle: true,
	})

	return &S3Store{client: client, bucket: bucket}, nil
}

func (s *S3Store) Save(filename string, data io.Reader) error {
	contentType := detectContentType(filename)
	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(filename),
		Body:        data,
		ContentType: aws.String(contentType),
	})
	return err
}

func (s *S3Store) Open(filename string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(filename),
	})
	if err != nil {
		return nil, err
	}
	return out.Body, nil
}

func (s *S3Store) Exists(filename string) bool {
	_, err := s.client.HeadObject(context.Background(), &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(filename),
	})
	return err == nil
}

func (s *S3Store) Delete(filename string) error {
	_, err := s.client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(filename),
	})
	return err
}

func (s *S3Store) List() ([]string, error) {
	var names []string
	paginator := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(context.Background())
		if err != nil {
			return nil, err
		}
		for _, obj := range page.Contents {
			names = append(names, aws.ToString(obj.Key))
		}
	}
	return names, nil
}

// Handler returns an http.Handler that proxies image requests to S3.
// For SVGs, it sets Content-Encoding: gzip when serving .svg.gz objects.
func (s *S3Store) Handler(prefix string) http.Handler {
	return http.StripPrefix(prefix, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		filename := strings.TrimPrefix(r.URL.Path, "/")
		if filename == "" {
			http.NotFound(w, r)
			return
		}

		// For SVG requests, try .svg.gz first
		if strings.HasSuffix(filename, ".svg") && strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			gzName := filename + ".gz"
			if s.Exists(gzName) {
				rc, err := s.Open(gzName)
				if err == nil {
					defer rc.Close()
					w.Header().Set("Content-Encoding", "gzip")
					w.Header().Set("Content-Type", "image/svg+xml")
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
					io.Copy(w, rc)
					return
				}
			}
		}

		rc, err := s.Open(filename)
		if err != nil {
			fmt.Fprintf(os.Stderr, "s3: GET %s error: %v\n", filename, err)
			http.NotFound(w, r)
			return
		}
		defer rc.Close()

		w.Header().Set("Content-Type", detectContentType(filename))
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		io.Copy(w, rc)
	}))
}

func detectContentType(filename string) string {
	switch {
	case strings.HasSuffix(filename, ".svg.gz"):
		return "image/svg+xml"
	case strings.HasSuffix(filename, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(filename, ".png"):
		return "image/png"
	case strings.HasSuffix(filename, ".jpg"), strings.HasSuffix(filename, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(filename, ".gif"):
		return "image/gif"
	case strings.HasSuffix(filename, ".webp"):
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}
