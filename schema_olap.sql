-- d:\mysql-5.7.15-winx64\bin\mysql.exe -u root < schema_olap.sql

USE mysql;

DROP DATABASE IF EXISTS frogpond_olap;

CREATE DATABASE frogpond_olap;

GRANT ALL PRIVILEGES ON frogpond_olap.* TO frogpond@localhost;

USE frogpond_olap;

-- contract enums:
-- TypeEnum: 0 unknown/none, 1 "Courier", 2 "ItemExchange"
-- StatusEnum: 0 unknown/none, 1 "Completed", 2 "Deleted", 3 "Failed", 4 "Rejected", 5 "Outstanding", 6 "InProgress"
-- AvailEnum: 0 unknown/none, 1 "Private", 2 "Public"

CREATE TABLE contract (
    ID BIGINT UNSIGNED NOT NULL,
    IssuerID BIGINT UNSIGNED NOT NULL,
    IssuerCorpID BIGINT UNSIGNED NOT NULL,
    AssigneeID BIGINT UNSIGNED NOT NULL DEFAULT 0,
    AcceptorID BIGINT UNSIGNED NOT NULL DEFAULT 0,
    StartStationID BIGINT UNSIGNED NOT NULL,
    EndStationID BIGINT UNSIGNED NOT NULL,
    TypeEnum TINYINT UNSIGNED NOT NULL DEFAULT 0,
    StatusEnum TINYINT UNSIGNED NOT NULL DEFAULT 0,
    CorpFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    AvailEnum TINYINT UNSIGNED NOT NULL DEFAULT 0,
    Title VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    DateIssued DATETIME NOT NULL,
    DateExpired DATETIME NOT NULL,
    DateAccepted DATETIME,
    DateCompleted DATETIME,
    NumDays SMALLINT UNSIGNED NOT NULL,
    Reward DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    Collateral DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    Volume DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    Price DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    Buyout DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    ChangeHash CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci,
    
    PRIMARY KEY (ID),
    INDEX (TypeEnum),
    INDEX (StatusEnum),
    INDEX (IssuerID),
    INDEX (AssigneeID),
    INDEX (AcceptorID)
);
