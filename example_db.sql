create table people(
	name varchar(255)
		constraint perople_pk
			primary key,
	dob date
);

create table places(
	name varchar(255)
		constraint places_pk
			primary key,
	size varchar(255)
);

create table transports(
	name varchar(255)
		constraint transports_pk
			primary key
);


create table visited(
	person varchar(255),
	place varchar(255),
	transport varchar(255),
	visited_date date,
		constraint fk_person
			foreign key(person) references people(name),
		constraint fk_place
			foreign key(place) references places(name),
		constraint fk_transport
			foreign key(transport) references transports(name),
		constraint person_place_date
			UNIQUE(person, place, visited_date)
);

create table knows(
	person1 varchar(255),
	person2 varchar(255),
		constraint fk_person_1
			foreign key(person1) references people(name),
		constraint fk_person_2
			foreign key(person2) references people(name)
);

insert into people (name, dob)
	values
		('Jane', '1993-05-26'),
		('John', '1995-10-05'),
		('Mark', '1997-11-03');

insert into places (name, size)
	values
		('Canelones', 'small'),
		('Montevideo', 'big');

insert into transports (name)
	values
		('Bike'),
		('Car'),
		('Plane');

insert into visited (person, place, transport, visited_date)
	values
		('John', 'Canelones', 'Bike', '2005-05-13'),
		('John', 'Canelones', 'Car', '2007-10-10'),
		('John', 'Canelones', 'Plane', '2012-12-05'),
		('Mark', 'Montevideo', 'Car', '2013-04-21');

insert into knows (person1, person2)
	values
		('John', 'Jane'),
		('John', 'Mark');

