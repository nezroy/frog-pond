-- d:\mysql-5.7.15-winx64\bin\mysql.exe -u root < schema_oltp.sql

USE mysql;

DROP DATABASE IF EXISTS frogpond_oltp;

CREATE DATABASE frogpond_oltp;

GRANT ALL PRIVILEGES ON frogpond_oltp.* TO frogpond@localhost;

USE frogpond_oltp;

-- contract enums:
-- TypeEnum: 0 unknown/none, 1 "Courier", 2 "ItemExchange"
-- StatusEnum: 0 unknown/none, 1 "Completed", 2 "Deleted", 3 "Failed", 4 "Rejected", 5 "Outstanding", 6 "InProgress"
-- AvailEnum: 0 unknown/none, 1 "Private", 2 "Public"

CREATE TABLE prog_attr (
	ID CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci,
	AttrVal VARCHAR(4096) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    
    PRIMARY KEY(ID)
);
INSERT INTO prog_attr (ID, AttrVal) VALUES('last_processed', '0');
INSERT INTO prog_attr (ID, AttrVal) VALUES('cached_until', '0');
INSERT INTO prog_attr (ID, AttrVal) VALUES('process_state', 'unknown');

CREATE TABLE rff_contract (
    ID BIGINT UNSIGNED NOT NULL,
    IssuerID BIGINT UNSIGNED NOT NULL,
    IssuerCorpID BIGINT UNSIGNED NOT NULL,
    AcceptorID BIGINT UNSIGNED NOT NULL DEFAULT 0,
    StartStationID BIGINT UNSIGNED NOT NULL,
    EndStationID BIGINT UNSIGNED NOT NULL,
    StatusEnum TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ValidFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    Title VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    DateIssued DATETIME NOT NULL,
    DateExpired DATETIME NOT NULL,
    DateAccepted DATETIME,
    DateCompleted DATETIME,
    NumDays SMALLINT UNSIGNED NOT NULL,
    Reward DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    Collateral DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    Volume DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    ChangeHash CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci,
    
    PRIMARY KEY (ID),
    INDEX (StatusEnum),
    INDEX (ValidFlag),
    INDEX (IssuerID),
    INDEX (AcceptorID)
);

CREATE TABLE bfl_contract (
    ID BIGINT UNSIGNED NOT NULL,
    IssuerID BIGINT UNSIGNED NOT NULL,
    IssuerCorpID BIGINT UNSIGNED NOT NULL,
    AcceptorID BIGINT UNSIGNED NOT NULL DEFAULT 0,
    StartStationID BIGINT UNSIGNED NOT NULL,
    EndStationID BIGINT UNSIGNED NOT NULL,
    StatusEnum TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ValidFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    Title VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    DateIssued DATETIME NOT NULL,
    DateExpired DATETIME NOT NULL,
    DateAccepted DATETIME,
    DateCompleted DATETIME,
    NumDays SMALLINT UNSIGNED NOT NULL,
    Reward DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    Collateral DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    Volume DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    ChangeHash CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci,
    
    PRIMARY KEY (ID),
    INDEX (StatusEnum),
    INDEX (ValidFlag),
    INDEX (IssuerID),
    INDEX (AcceptorID)    
);

CREATE TABLE role (
    ID CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci,
    Description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    FixedFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    
    PRIMARY KEY(ID)
);
CREATE TABLE role_priv (
    ID CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci,
    PrivID CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci,
    DenyFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    
    PRIMARY KEY (ID, PrivID),
    FOREIGN KEY (ID) REFERENCES role(ID) ON UPDATE CASCADE ON DELETE RESTRICT
);
INSERT INTO role (ID, Description, FixedFlag) VALUES('admin', 'Built-in administrator role.', 1);

INSERT INTO role (ID, Description, FixedFlag) VALUES('sso_auth', 'Built-in role for EVESSO users not in RFF or BFL.', 1);
INSERT INTO role_priv (ID, PrivID) VALUES('sso_auth', 'contracts_view_own');
INSERT INTO role_priv (ID, PrivID) VALUES('sso_auth', 'tokens_edit_own');

INSERT INTO role (ID, Description, FixedFlag) VALUES('sso_rff', 'Built-in role for EVESSO users in RFF.', 1);
INSERT INTO role_priv (ID, PrivID) VALUES('sso_rff', 'contracts_view_own');
INSERT INTO role_priv (ID, PrivID) VALUES('sso_rff', 'tokens_edit_own');
INSERT INTO role_priv (ID, PrivID) VALUES('sso_rff', 'rff_menu_view');
INSERT INTO role_priv (ID, PrivID) VALUES('sso_rff', 'rff_members_edit_own');

INSERT INTO role (ID, Description, FixedFlag) VALUES('sso_bfl', 'Built-in role for EVESSO users in BFL.', 1);
INSERT INTO role_priv (ID, PrivID) VALUES('sso_bfl', 'contracts_view_own');
INSERT INTO role_priv (ID, PrivID) VALUES('sso_bfl', 'tokens_edit_own');
INSERT INTO role_priv (ID, PrivID) VALUES('sso_bfl', 'bfl_menu_view');

INSERT INTO role (ID, Description, FixedFlag) VALUES('rff_member', 'Built-in role for members in RFF.', 1);
INSERT INTO role_priv (ID, PrivID) VALUES('rff_member', 'rff_dash_view');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_member', 'rff_manual_view');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_member', 'rff_ncf_view_valid');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_member', 'rff_tracker_view_own');

INSERT INTO role (ID, Description, FixedFlag) VALUES('bfl_member', 'Built-in role for members in BFL.', 1);
INSERT INTO role_priv (ID, PrivID) VALUES('bfl_member', 'bfl_manual_view');
INSERT INTO role_priv (ID, PrivID) VALUES('bfl_member', 'bfl_ncf_view_valid');
INSERT INTO role_priv (ID, PrivID) VALUES('bfl_member', 'bfl_tracker_view_own');

INSERT INTO role (ID, Description, FixedFlag) VALUES('rff_ncf_manager', 'Role for managing RFF contracts.', 0);
INSERT INTO role_priv (ID, PrivID) VALUES('rff_ncf_manager', 'rff_mgrdash_view');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_ncf_manager', 'rff_ncf_view_invalid');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_ncf_manager', 'rff_ncf_reject');

INSERT INTO role (ID, Description, FixedFlag) VALUES('rff_pilot_manager', 'Role for managing RFF pilots.', 0);
INSERT INTO role_priv (ID, PrivID) VALUES('rff_pilot_manager', 'rff_mgrdash_view');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_pilot_manager', 'rff_tracker_view_any');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_pilot_manager', 'rff_members_view');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_pilot_manager', 'rff_members_edit_info');

INSERT INTO role (ID, Description, FixedFlag) VALUES('rff_role_manager', 'Role for applying roles to RFF members.', 0);
INSERT INTO role_priv (ID, PrivID) VALUES('rff_role_manager', 'rff_members_edit_roles');

INSERT INTO role (ID, Description, FixedFlag) VALUES('rff_editor', 'Role for editing RFF site content.', 0);
INSERT INTO role_priv (ID, PrivID) VALUES('rff_editor', 'rff_trip_calc_edit');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_editor', 'rff_faq_edit');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_member', 'rff_faq_tree');
INSERT INTO role_priv (ID, PrivID) VALUES('rff_editor', 'rff_ncf_edit');

CREATE TABLE member (
    ID CHAR(10) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    ApplicationNo INT UNSIGNED DEFAULT NULL,
    StatusEnum TINYINT UNSIGNED NOT NULL DEFAULT 0,
    RoleEnum TINYINT UNSIGNED NOT NULL DEFAULT 0,
    Notes TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    StackFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    RFFFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    BFLFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    
    PRIMARY KEY (ID),
    UNIQUE INDEX (ApplicationNo),
    INDEX (StatusEnum),
    INDEX (RoleEnum)
);
-- INSERT INTO member (ID, StatusEnum, RoleEnum, RFFFlag) VALUES (542, 1, 3, 1);
CREATE TABLE member_attr (
    ID CHAR(10) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    TypeEnum SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    Val VARCHAR(256),
    
    INDEX (ID, TypeEnum),
    INDEX (Val),
    FOREIGN KEY (ID) REFERENCES member(ID) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE TABLE member_role (
    ID CHAR(10) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    RoleID CHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    
    PRIMARY KEY (ID, RoleID),
    FOREIGN KEY (ID) REFERENCES member(ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (RoleID) REFERENCES role(ID) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE eveapi (
    ID BIGINT UNSIGNED NOT NULL,
    VCode VARCHAR(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    Expires DATETIME DEFAULT NULL,
    Mask INT UNSIGNED NOT NULL,
    LastAccess DATETIME DEFAULT NULL,
    MemberID CHAR(10) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    Char1ID BIGINT UNSIGNED NOT NULL DEFAULT 0,
    Char2ID BIGINT UNSIGNED NOT NULL DEFAULT 0,
    Char3ID BIGINT UNSIGNED NOT NULL DEFAULT 0,
    
    PRIMARY KEY (ID),
    FOREIGN KEY (MemberID) REFERENCES member(ID) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX (Char1ID),
    INDEX (Char2ID),
    INDEX (Char3ID)
);

CREATE TABLE evechar (
    ID BIGINT UNSIGNED NOT NULL,
    Name VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    DeletedName VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
    CorpID BIGINT UNSIGNED NOT NULL DEFAULT 0,
    MemberID CHAR(10) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
    CrestToken CHAR(200) CHARACTER SET ascii COLLATE ascii_general_ci,
    TokenVer INT UNSIGNED,
    TypeEnum TINYINT UNSIGNED NOT NULL DEFAULT 0,
    
    PRIMARY KEY (ID),
    UNIQUE INDEX (Name),
    INDEX (CorpID),
    FOREIGN KEY (MemberID) REFERENCES member(ID) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE evecorp (
    ID BIGINT UNSIGNED NOT NULL,
    Name VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    NpcFlag TINYINT UNSIGNED NOT NULL DEFAULT 0,
    
    PRIMARY KEY (ID),
    UNIQUE INDEX (Name)
);
