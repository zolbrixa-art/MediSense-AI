-- MediSense AI — Microsoft SQL Server Schema
-- Dialect-specific: IDENTITY, NVARCHAR, DATETIME2, BIT, FLOAT

-- Core Users Table
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PublicId NVARCHAR(36) UNIQUE NOT NULL,
    Email NVARCHAR(255) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(255) NOT NULL,
    Role NVARCHAR(20) NOT NULL CHECK (Role IN ('Patient', 'Doctor', 'Admin', 'LabTech')),
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Doctor Scheduling & Queue Control
CREATE TABLE DoctorSchedules (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    DoctorId INT FOREIGN KEY REFERENCES Users(Id),
    Department NVARCHAR(100) NOT NULL,
    CurrentServingToken INT DEFAULT 0,
    LastAllocatedToken INT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    ShiftDate DATE NOT NULL,
    CONSTRAINT UQ_DoctorSchedule_DoctorShift UNIQUE (DoctorId, ShiftDate)
);

-- Appointments & Live Queue
CREATE TABLE Appointments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TokenNumber INT NOT NULL,
    PatientId INT FOREIGN KEY REFERENCES Users(Id),
    DoctorId INT FOREIGN KEY REFERENCES Users(Id),
    Status NVARCHAR(20) DEFAULT 'Pending' CHECK (Status IN ('Pending', 'InConsultation', 'Completed', 'Skipped')),
    ScheduledTime DATETIME2 NOT NULL,
    StartedAt DATETIME2 NULL,
    CompletedAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Appointment_DoctorDateToken UNIQUE (DoctorId, ScheduledTime, TokenNumber)
);

-- Diagnostic Imaging & Vision Detections
CREATE TABLE DiagnosticScans (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PatientId INT FOREIGN KEY REFERENCES Users(Id),
    UploadedBy INT FOREIGN KEY REFERENCES Users(Id),
    ScanType NVARCHAR(50) NOT NULL CHECK (ScanType IN ('X-Ray', 'MRI', 'CT')),
    FilePath NVARCHAR(500) NOT NULL,
    AIInferenceResults NVARCHAR(MAX), -- JSON string of bounding boxes & labels
    ConfidenceScore FLOAT,
    UploadedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Audit Logs
CREATE TABLE AuditLogs (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    Timestamp DATETIME2 DEFAULT SYSUTCDATETIME(),
    ActorId INT NOT NULL,
    ActorRole NVARCHAR(20) NOT NULL,
    TargetPatientId INT NOT NULL,
    ActionType NVARCHAR(50) NOT NULL,
    IPAddress NVARCHAR(45) NOT NULL
);

-- Clinical Encounter Notes
CREATE TABLE EncounterNotes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PatientId INT FOREIGN KEY REFERENCES Users(Id),
    DoctorId INT FOREIGN KEY REFERENCES Users(Id),
    AppointmentId INT FOREIGN KEY REFERENCES Appointments(Id),
    Subjective NVARCHAR(MAX),
    Assessment NVARCHAR(MAX),
    Plan NVARCHAR(MAX),
    SignedAt DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Wearable Vitals Telemetry
CREATE TABLE VitalReadings (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PatientId INT FOREIGN KEY REFERENCES Users(Id),
    HeartRate INT,
    SpO2 INT,
    TemperatureF FLOAT,
    SleepQuality NVARCHAR(20),
    AlertLevel NVARCHAR(20) DEFAULT 'NORMAL' CHECK (AlertLevel IN ('NORMAL', 'WARNING', 'CRITICAL')),
    RecordedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Prescriptions
CREATE TABLE Prescriptions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EncounterId INT FOREIGN KEY REFERENCES EncounterNotes(Id),
    DrugName NVARCHAR(255) NOT NULL,
    Dose NVARCHAR(100),
    Frequency NVARCHAR(100),
    Duration NVARCHAR(100),
    CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
);
