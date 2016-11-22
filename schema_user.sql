-- d:\mysql-5.7.15-winx64\bin\mysql.exe -u root < schema_user.sql

USE mysql;

DROP USER IF EXISTS frogpond@localhost;

GRANT USAGE ON *.* TO frogpond@localhost IDENTIFIED BY 'CHANGE_ME';
GRANT ALL PRIVILEGES ON frogpond_oltp.* TO frogpond@localhost;
GRANT ALL PRIVILEGES ON frogpond_olap.* TO frogpond@localhost;
