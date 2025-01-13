PRAGMA defer_foreign_keys=TRUE;

DROP TABLE [hosts];

CREATE TABLE [hosts] (
	"hostkey" text PRIMARY KEY,
	"hostname" text,
	"lastcheckin" integer,
	"disconnected" integer
 );

INSERT INTO hosts VALUES(
	'F90A3488-E3A7-4066-B54E-B99093CC4CEC',
	'Default Host',
	1735689600,
	true
);
