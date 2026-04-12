package version

import (
	"fmt"
	"os"
	"runtime"
	"time"
)

var (
	Version   = "dev"
	GitCommit = "unknown"
	BuildTime = "unknown"
	startedAt = time.Now()
)

type Info struct {
	Version   string `json:"version"`
	GitCommit string `json:"git_commit"`
	BuildTime string `json:"build_time"`
	GoVersion string `json:"go_version,omitempty"`
	Platform  string `json:"platform,omitempty"`
}

func Get() Info {
	return Info{
		Version:   Version,
		GitCommit: GitCommit,
		BuildTime: BuildTime,
	}
}

type VersionResponse struct {
	Backend  Info        `json:"backend"`
	Runtime  RuntimeInfo `json:"runtime"`
	Database string      `json:"database"`
}

type RuntimeInfo struct {
	Hostname string `json:"hostname"`
	PID      int    `json:"pid"`
	Port     int    `json:"port,omitempty"`
	Uptime   int64  `json:"uptime_seconds"`
	Started  string `json:"started_at"`
}

func GetFull(port int) VersionResponse {
	hostname, _ := os.Hostname()
	return VersionResponse{
		Backend: Info{
			Version:   Version,
			GitCommit: GitCommit,
			BuildTime: BuildTime,
			GoVersion: runtime.Version(),
			Platform:  fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
		},
		Runtime: RuntimeInfo{
			Hostname: hostname,
			PID:      os.Getpid(),
			Port:     port,
			Uptime:   int64(time.Since(startedAt).Seconds()),
			Started:  startedAt.UTC().Format(time.RFC3339),
		},
		Database: "sqlite",
	}
}
